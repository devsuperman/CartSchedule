using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using CartSchedule.Api.Tests.Infraestrutura;

namespace CartSchedule.Api.Tests.Administradores;

/// <summary>
/// Redefinir PIN e desativar/reativar (issue #46): ambos desconectam todos os aparelhos da
/// pessoa — cada request autenticado confere que o publicador está ativo e que a versão de
/// sessão do token é a atual.
/// </summary>
public class RedefinirPinEDesativarTests(ApiFixture fixture) : ApiTestBase(fixture)
{
    private const string RotaAdmin = "/api/admin/publicadores";

    private static Task<HttpResponseMessage> RedefinirPinAsync(HttpClient admin, Guid id) =>
        admin.PostAsync($"{RotaAdmin}/{id}/pin", null);

    private static Task<HttpResponseMessage> EditarAsync(HttpClient admin, Guid id, object corpo) =>
        admin.PutAsJsonAsync($"{RotaAdmin}/{id}", corpo);

    private async Task<HttpClient> LogadoAsync(string usuario, string pin)
    {
        var login = await LoginAsync(Fixture.Factory.CreateClient(), usuario, pin);
        login.EnsureSuccessStatusCode();
        return ClienteComToken(await JsonAsync(login));
    }

    private static async Task<string[]> NomesAsync(HttpClient admin, string query = "") =>
        (await admin.GetFromJsonAsync<JsonElement>(RotaAdmin + query))
        .EnumerateArray().Select(p => p.GetProperty("nome").GetString()!).ToArray();

    [Fact]
    public async Task RedefinirPin_DevolveNovoPin_QueEntra_EOAntigoNaoEntraMais()
    {
        var admin = await AdminAsync();
        var (id, pinAntigo) = await CriarContaAsync(admin, "Joao Silva", "Joao");

        var resposta = await RedefinirPinAsync(admin, id);

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);
        var corpo = await JsonAsync(resposta);
        Assert.Equal("Joao", corpo.GetProperty("usuario").GetString());
        var pinNovo = corpo.GetProperty("pin").GetString()!;
        Assert.Matches("^[0-9]{4}$", pinNovo);
        Assert.Equal(HttpStatusCode.OK, (await LoginAsync(Fixture.Factory.CreateClient(), "joao", pinNovo)).StatusCode);
        if (pinNovo != pinAntigo)
        {
            Assert.Equal(HttpStatusCode.Unauthorized, (await LoginAsync(Fixture.Factory.CreateClient(), "joao", pinAntigo)).StatusCode);
        }
    }

    [Fact]
    public async Task RedefinirPin_TokensAnterioresRecebem401_ENovoLoginFunciona()
    {
        var admin = await AdminAsync();
        var (id, pin) = await CriarContaAsync(admin, "Maria", "maria", administrador: true);
        var aparelho1 = await LogadoAsync("maria", pin);
        var aparelho2 = await LogadoAsync("maria", pin);
        Assert.Equal(HttpStatusCode.OK, (await aparelho1.GetAsync(RotaAdmin)).StatusCode);

        var novoPin = (await JsonAsync(await RedefinirPinAsync(admin, id))).GetProperty("pin").GetString()!;

        Assert.Equal(HttpStatusCode.Unauthorized, (await aparelho1.GetAsync(RotaAdmin)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await aparelho2.GetAsync(RotaAdmin)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await (await LogadoAsync("maria", novoPin)).GetAsync(RotaAdmin)).StatusCode);
    }

    [Fact]
    public async Task RedefinirPin_PublicadorComum_TokenAntigoPassaA401()
    {
        var admin = await AdminAsync();
        var (id, pin) = await CriarContaAsync(admin, "Joao", "joao");
        var aparelho = await LogadoAsync("joao", pin);
        // Autenticado, mas sem papel administrativo.
        Assert.Equal(HttpStatusCode.Forbidden, (await aparelho.GetAsync(RotaAdmin)).StatusCode);

        await RedefinirPinAsync(admin, id);

        Assert.Equal(HttpStatusCode.Unauthorized, (await aparelho.GetAsync(RotaAdmin)).StatusCode);
    }

    [Fact]
    public async Task RedefinirPin_RegistroSemUsuario_Retorna400SemUsuario()
    {
        var admin = await AdminAsync();
        var carrinhoId = await CriarCarrinhoAsync(admin);
        await DefinirTurnosAsync(admin, carrinhoId, (Segunda, Turno0810));
        (await AdicionarManualAsync(admin, carrinhoId, Segunda, Turno0810, "Pedro")).EnsureSuccessStatusCode();
        var id = PedidosDaGrade(await GradeAsync(admin)).Single().GetProperty("publicadorId").GetGuid();

        var resposta = await RedefinirPinAsync(admin, id);

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
        Assert.Equal("SEM_USUARIO", (await JsonAsync(resposta)).GetProperty("codigo").GetString());
    }

    [Fact]
    public async Task RedefinirPin_Inexistente404_EPublicadorComum403()
    {
        var admin = await AdminAsync();
        var (id, pin) = await CriarContaAsync(admin, "Joao", "joao");

        Assert.Equal(HttpStatusCode.NotFound, (await RedefinirPinAsync(admin, Guid.NewGuid())).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await RedefinirPinAsync(await LogadoAsync("joao", pin), id)).StatusCode);
    }

    [Fact]
    public async Task Desativar_TokensAnterioresRecebem401_ELoginRecusadoComPublicadorInativo()
    {
        var admin = await AdminAsync();
        var (id, pin) = await CriarContaAsync(admin, "Maria", "maria", administrador: true);
        var aparelho = await LogadoAsync("maria", pin);

        Assert.Equal(HttpStatusCode.NoContent, (await EditarAsync(admin, id, new { ativo = false })).StatusCode);

        Assert.Equal(HttpStatusCode.Unauthorized, (await aparelho.GetAsync(RotaAdmin)).StatusCode);
        var login = await LoginAsync(Fixture.Factory.CreateClient(), "maria", pin);
        Assert.Equal(HttpStatusCode.Forbidden, login.StatusCode);
        Assert.Equal("PUBLICADOR_INATIVO", (await JsonAsync(login)).GetProperty("codigo").GetString());
    }

    [Fact]
    public async Task Reativar_PermiteLogarDeNovoComOMesmoPin_MasTokensAntigosContinuamInvalidos()
    {
        var admin = await AdminAsync();
        var (id, pin) = await CriarContaAsync(admin, "Maria", "maria", administrador: true);
        var aparelhoAntigo = await LogadoAsync("maria", pin);
        await EditarAsync(admin, id, new { ativo = false });

        Assert.Equal(HttpStatusCode.NoContent, (await EditarAsync(admin, id, new { ativo = true })).StatusCode);

        Assert.Equal(HttpStatusCode.Unauthorized, (await aparelhoAntigo.GetAsync(RotaAdmin)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await (await LogadoAsync("maria", pin)).GetAsync(RotaAdmin)).StatusCode);
    }

    [Fact]
    public async Task EditarOutrosCampos_NaoDesconectaOsAparelhos()
    {
        var admin = await AdminAsync();
        var (id, pin) = await CriarContaAsync(admin, "Maria", "maria", administrador: true);
        var aparelho = await LogadoAsync("maria", pin);

        await EditarAsync(admin, id, new { nome = "Maria Souza", criancaOuIdoso = true, ativo = true });

        Assert.Equal(HttpStatusCode.OK, (await aparelho.GetAsync(RotaAdmin)).StatusCode);
    }

    [Fact]
    public async Task TirarAdministrador_TokenAdministrativoAntigoDeixaDeValer()
    {
        var admin = await AdminAsync();
        var (id, pin) = await CriarContaAsync(admin, "Maria", "maria", administrador: true);
        var aparelho = await LogadoAsync("maria", pin);

        await EditarAsync(admin, id, new { administrador = false });

        Assert.Equal(HttpStatusCode.Unauthorized, (await aparelho.GetAsync(RotaAdmin)).StatusCode);
    }

    [Fact]
    public async Task DarAdministrador_NaoDesconecta_PapelNovoVemNoProximoLogin()
    {
        var admin = await AdminAsync();
        var (id, pin) = await CriarContaAsync(admin, "Joao", "joao");
        var aparelho = await LogadoAsync("joao", pin);

        await EditarAsync(admin, id, new { administrador = true });

        // Ainda autenticado (403, não 401) com o token de publicador.
        Assert.Equal(HttpStatusCode.Forbidden, (await aparelho.GetAsync(RotaAdmin)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await (await LogadoAsync("joao", pin)).GetAsync(RotaAdmin)).StatusCode);
    }

    [Fact]
    public async Task PublicadorApagado_TokenRecebe401()
    {
        var admin = await AdminAsync();
        var (id, pin) = await CriarContaAsync(admin, "Maria", "maria", administrador: true);
        var aparelho = await LogadoAsync("maria", pin);

        await Fixture.LimparAsync();

        Assert.Equal(HttpStatusCode.Unauthorized, (await aparelho.GetAsync(RotaAdmin)).StatusCode);
    }

    [Fact]
    public async Task Desativado_SomeDaListaPorPadrao_ApareceComIncluirInativos_EMantemOHistoricoNaEscala()
    {
        var admin = await AdminAsync();
        var carrinhoId = await CriarCarrinhoAsync(admin);
        await DefinirTurnosAsync(admin, carrinhoId, (Segunda, Turno0810));
        (await AdicionarManualAsync(admin, carrinhoId, Segunda, Turno0810, "Pedro")).EnsureSuccessStatusCode();
        var pedroId = PedidosDaGrade(await GradeAsync(admin)).Single().GetProperty("publicadorId").GetGuid();
        await CriarContaAsync(admin, "Ana", "ana");

        await EditarAsync(admin, pedroId, new { ativo = false });

        Assert.Equal(["Ana"], await NomesAsync(admin));
        Assert.Equal(["Ana"], await NomesAsync(admin, "?incluirInativos=false"));
        var todos = (await admin.GetFromJsonAsync<JsonElement>(RotaAdmin + "?incluirInativos=true")).EnumerateArray().ToArray();
        Assert.Equal(["Ana", "Pedro"], todos.Select(p => p.GetProperty("nome").GetString()));
        Assert.False(todos.Single(p => p.GetProperty("id").GetGuid() == pedroId).GetProperty("ativo").GetBoolean());
        Assert.Equal(["Pedro"], await NomesAsync(admin, "?busca=ped&incluirInativos=true"));

        var pedido = Assert.Single(PedidosDaGrade(await GradeAsync(admin)));
        Assert.Equal(pedroId, pedido.GetProperty("publicadorId").GetGuid());
    }
}
