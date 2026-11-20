using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using CartSchedule.Api.Tests.Infraestrutura;

namespace CartSchedule.Api.Tests.Administradores;

/// <summary>
/// Redefinir PIN (issue #46) desconecta todos os aparelhos da pessoa — cada request autenticado
/// confere que o publicador existe e que a versão de sessão do token é a atual. Desde a ADR 0002
/// não há mais desativar: redefinir o PIN é o jeito de bloquear o acesso por um tempo.
/// </summary>
public class RedefinirPinTests(ApiFixture fixture) : ApiTestBase(fixture)
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
        (await AdicionarRegistroAntigoPorNomeAsync(admin, carrinhoId, Segunda, Turno0810, "Pedro")).EnsureSuccessStatusCode();
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
    public async Task EditarOutrosCampos_NaoDesconectaOsAparelhos()
    {
        var admin = await AdminAsync();
        var (id, pin) = await CriarContaAsync(admin, "Maria", "maria", administrador: true);
        var aparelho = await LogadoAsync("maria", pin);

        await EditarAsync(admin, id, new { nome = "Maria Souza", criancaOuIdoso = true });

        Assert.Equal(HttpStatusCode.OK, (await aparelho.GetAsync(RotaAdmin)).StatusCode);
    }

    [Fact]
    public async Task CampoAtivo_NaoExisteMais_EdicaoIgnoraELoginESessaoContinuam()
    {
        // ADR 0002: a marca ativo saiu; quem ainda mandar { ativo: false } não desativa ninguém.
        var admin = await AdminAsync();
        var (id, pin) = await CriarContaAsync(admin, "Maria", "maria", administrador: true);
        var aparelho = await LogadoAsync("maria", pin);

        Assert.Equal(HttpStatusCode.NoContent, (await EditarAsync(admin, id, new { ativo = false })).StatusCode);

        Assert.Equal(HttpStatusCode.OK, (await aparelho.GetAsync(RotaAdmin)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await LoginAsync(Fixture.Factory.CreateClient(), "maria", pin)).StatusCode);
        var item = Assert.Single((await admin.GetFromJsonAsync<JsonElement>(RotaAdmin)).EnumerateArray());
        Assert.False(item.TryGetProperty("ativo", out _));
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
    public async Task Administrador_NaoTiraOProprioAdministrador_MasEditaOResto()
    {
        var recuperacao = await AdminAsync();
        var (id, pin) = await CriarContaAsync(recuperacao, "Maria", "maria", administrador: true);
        var maria = await LogadoAsync("maria", pin);

        var resposta = await EditarAsync(maria, id, new { administrador = false });
        Assert.Equal(HttpStatusCode.Conflict, resposta.StatusCode);
        Assert.Equal("PROPRIA_CONTA", (await JsonAsync(resposta)).GetProperty("codigo").GetString());

        Assert.Equal(HttpStatusCode.NoContent,
            (await EditarAsync(maria, id, new { nome = "Maria Souza", administrador = true })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await maria.GetAsync(RotaAdmin)).StatusCode);
    }

    [Fact]
    public async Task Lista_MarcaQuemEstaLogado_ERecuperacaoNaoEhNinguem()
    {
        var recuperacao = await AdminAsync();
        var (mariaId, pin) = await CriarContaAsync(recuperacao, "Maria", "maria", administrador: true);
        await CriarContaAsync(recuperacao, "Ana", "ana");
        var maria = await LogadoAsync("maria", pin);

        var vistaPelaMaria = (await maria.GetFromJsonAsync<JsonElement>(RotaAdmin)).EnumerateArray()
            .ToDictionary(p => p.GetProperty("id").GetGuid(), p => p.GetProperty("ehVoce").GetBoolean());
        var vistaPelaRecuperacao = (await recuperacao.GetFromJsonAsync<JsonElement>(RotaAdmin)).EnumerateArray()
            .Select(p => p.GetProperty("ehVoce").GetBoolean());

        Assert.True(vistaPelaMaria[mariaId]);
        Assert.Single(vistaPelaMaria, p => p.Value);
        Assert.All(vistaPelaRecuperacao, Assert.False);
    }
}
