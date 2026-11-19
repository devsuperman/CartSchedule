using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using CartSchedule.Api.Tests.Infraestrutura;

namespace CartSchedule.Api.Tests.Administradores;

/// <summary>
/// Tela "Publicadores": listar/buscar, criar conta (PIN gerado devolvido uma única vez) e
/// editar campos parciais, inclusive dar usuário e PIN a um registro antigo.
/// </summary>
public class GerenciarPublicadoresTests(ApiFixture fixture) : ApiTestBase(fixture)
{
    private static async Task<JsonElement[]> ListarAsync(HttpClient admin, string? busca = null) =>
        (await admin.GetFromJsonAsync<JsonElement>(
            busca is null ? "/api/admin/publicadores" : $"/api/admin/publicadores?busca={Uri.EscapeDataString(busca)}"))
        .EnumerateArray().ToArray();

    private static Task<HttpResponseMessage> EditarAsync(HttpClient admin, Guid id, object corpo) =>
        admin.PutAsJsonAsync($"/api/admin/publicadores/{id}", corpo);

    /// <summary>Registro antigo, sem usuário/PIN, com um pedido (criado pela adição manual por nome).</summary>
    private async Task<(HttpClient Admin, Guid Id)> RegistroAntigoComPedidoAsync(string nome = "Pedro Alves")
    {
        var admin = await AdminAsync();
        var carrinhoId = await CriarCarrinhoAsync(admin);
        await DefinirTurnosAsync(admin, carrinhoId, (Segunda, Turno0810));
        var adicao = await AdicionarManualAsync(admin, carrinhoId, Segunda, Turno0810, nome);
        adicao.EnsureSuccessStatusCode();
        return (admin, PedidosDaGrade(await GradeAsync(admin)).Single().GetProperty("publicadorId").GetGuid());
    }

    [Fact]
    public async Task Criar_DevolvePinDe4DigitosNaoObvio_EApareceNaLista()
    {
        var admin = await AdminAsync();

        var resposta = await admin.PostAsJsonAsync("/api/admin/publicadores", new
        {
            nome = "Maria Souza", usuario = "Maria", criancaOuIdoso = true, administrador = true,
        });

        Assert.Equal(HttpStatusCode.Created, resposta.StatusCode);
        var corpo = await JsonAsync(resposta);
        var pin = corpo.GetProperty("pin").GetString()!;
        Assert.Matches("^[0-9]{4}$", pin);
        Assert.DoesNotContain(pin, new[] { "0000", "1111", "1234", "4321", "6789", "9876" });
        Assert.Equal("Maria", corpo.GetProperty("usuario").GetString());

        var item = Assert.Single(await ListarAsync(admin));
        Assert.Equal(corpo.GetProperty("id").GetGuid(), item.GetProperty("id").GetGuid());
        Assert.Equal("Maria Souza", item.GetProperty("nome").GetString());
        Assert.Equal("Maria", item.GetProperty("usuario").GetString());
        Assert.True(item.GetProperty("criancaOuIdoso").GetBoolean());
        Assert.True(item.GetProperty("administrador").GetBoolean());
        Assert.True(item.GetProperty("ativo").GetBoolean());
        Assert.True(item.GetProperty("temPin").GetBoolean());
        Assert.False(item.TryGetProperty("pin", out _));
    }

    [Theory]
    [InlineData("maria")]
    [InlineData("MARIA")]
    [InlineData("María")]
    public async Task Criar_UsuarioJaUsadoIgnorandoMaiusculasEAcentos_Retorna409(string usuario)
    {
        var admin = await AdminAsync();
        await CriarContaAsync(admin, "Maria Souza", "Maria");

        var resposta = await admin.PostAsJsonAsync("/api/admin/publicadores", new
        {
            nome = "Maria Santos", usuario, criancaOuIdoso = false, administrador = false,
        });

        Assert.Equal(HttpStatusCode.Conflict, resposta.StatusCode);
        Assert.Equal("USUARIO_EM_USO", (await JsonAsync(resposta)).GetProperty("codigo").GetString());
    }

    [Theory]
    [InlineData("", "maria")]
    [InlineData("Maria", "")]
    [InlineData("Maria", "maria souza")]
    public async Task Criar_NomeOuUsuarioInvalido_Retorna400(string nome, string usuario)
    {
        var admin = await AdminAsync();

        var resposta = await admin.PostAsJsonAsync("/api/admin/publicadores", new
        {
            nome, usuario, criancaOuIdoso = false, administrador = false,
        });

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
    }

    [Fact]
    public async Task Listar_IncluiRegistrosAntigosSemUsuario_EBuscaPorNomeOuUsuarioSemAcento()
    {
        var (admin, antigoId) = await RegistroAntigoComPedidoAsync("José Lima");
        await CriarContaAsync(admin, "Ana Paula", "aninha");
        await CriarContaAsync(admin, "Bruno", "bruno");

        var todos = await ListarAsync(admin);
        Assert.Equal(["Ana Paula", "Bruno", "José Lima"], todos.Select(p => p.GetProperty("nome").GetString()));
        var antigo = todos.Single(p => p.GetProperty("id").GetGuid() == antigoId);
        Assert.Equal(JsonValueKind.Null, antigo.GetProperty("usuario").ValueKind);
        Assert.False(antigo.GetProperty("temPin").GetBoolean());

        Assert.Equal(["José Lima"], (await ListarAsync(admin, "jose")).Select(p => p.GetProperty("nome").GetString()));
        Assert.Equal(["Ana Paula"], (await ListarAsync(admin, "ANINHA")).Select(p => p.GetProperty("nome").GetString()));
    }

    [Fact]
    public async Task Editar_CamposParciais_AusenteNaoMuda()
    {
        var admin = await AdminAsync();
        var (id, pin) = await CriarContaAsync(admin, "Joao", "joao", criancaOuIdoso: true);

        Assert.Equal(HttpStatusCode.NoContent, (await EditarAsync(admin, id, new { administrador = true })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await EditarAsync(admin, id, new { nome = "João Silva" })).StatusCode);

        var item = Assert.Single(await ListarAsync(admin));
        Assert.Equal("João Silva", item.GetProperty("nome").GetString());
        Assert.Equal("joao", item.GetProperty("usuario").GetString());
        Assert.True(item.GetProperty("criancaOuIdoso").GetBoolean());
        Assert.True(item.GetProperty("administrador").GetBoolean());
        var login = await LoginAsync(Fixture.Factory.CreateClient(), "joao", pin);
        Assert.Equal("administrador", (await JsonAsync(login)).GetProperty("papel").GetString());
    }

    [Fact]
    public async Task Editar_TirarAdministrador_LoginVoltaASerDePublicador()
    {
        var admin = await AdminAsync();
        var (id, pin) = await CriarContaAsync(admin, "Joao", "joao", administrador: true);

        await EditarAsync(admin, id, new { administrador = false });

        var login = await LoginAsync(Fixture.Factory.CreateClient(), "joao", pin);
        Assert.Equal("publicador", (await JsonAsync(login)).GetProperty("papel").GetString());
    }

    [Fact]
    public async Task Editar_TrocaUsuario_MantemOPin()
    {
        var admin = await AdminAsync();
        var (id, pin) = await CriarContaAsync(admin, "Joao", "joao");

        var resposta = await EditarAsync(admin, id, new { usuario = "JoaoS" });

        Assert.Equal(HttpStatusCode.NoContent, resposta.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await LoginAsync(Fixture.Factory.CreateClient(), "joaos", pin)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await LoginAsync(Fixture.Factory.CreateClient(), "joao", pin)).StatusCode);
    }

    [Fact]
    public async Task Editar_UsuarioDeOutro_Retorna409_EOProprioComOutraGrafiaEhPermitido()
    {
        var admin = await AdminAsync();
        await CriarContaAsync(admin, "Maria", "maria");
        var (joaoId, _) = await CriarContaAsync(admin, "Joao", "joao");

        var emUso = await EditarAsync(admin, joaoId, new { usuario = "Maria" });
        Assert.Equal(HttpStatusCode.Conflict, emUso.StatusCode);
        Assert.Equal("USUARIO_EM_USO", (await JsonAsync(emUso)).GetProperty("codigo").GetString());

        Assert.Equal(HttpStatusCode.NoContent, (await EditarAsync(admin, joaoId, new { usuario = "João" })).StatusCode);
    }

    [Fact]
    public async Task Editar_RegistroAntigoRecebeUsuario_GeraPin_EMantemIdEHistorico()
    {
        var (admin, id) = await RegistroAntigoComPedidoAsync();

        var resposta = await EditarAsync(admin, id, new { usuario = "pedro" });

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);
        var corpo = await JsonAsync(resposta);
        Assert.Equal("pedro", corpo.GetProperty("usuario").GetString());
        var pin = corpo.GetProperty("pin").GetString()!;
        Assert.Matches("^[0-9]{4}$", pin);

        Assert.Equal(HttpStatusCode.OK, (await LoginAsync(Fixture.Factory.CreateClient(), "pedro", pin)).StatusCode);
        var pedido = Assert.Single(PedidosDaGrade(await GradeAsync(admin)));
        Assert.Equal(id, pedido.GetProperty("publicadorId").GetGuid());
        Assert.True(Assert.Single(await ListarAsync(admin)).GetProperty("temPin").GetBoolean());
    }

    [Fact]
    public async Task Editar_UsuarioVazio_Retorna400()
    {
        var admin = await AdminAsync();
        var (id, _) = await CriarContaAsync(admin, "Joao", "joao");

        Assert.Equal(HttpStatusCode.BadRequest, (await EditarAsync(admin, id, new { usuario = " " })).StatusCode);
    }

    [Fact]
    public async Task PublicadorComum_Recebe403_ESemLogin401()
    {
        var admin = await AdminAsync();
        var (_, pin) = await CriarContaAsync(admin, "Joao", "joao");
        var publicador = ClienteComToken(await JsonAsync(await LoginAsync(Fixture.Factory.CreateClient(), "joao", pin)));

        Assert.Equal(HttpStatusCode.Forbidden, (await publicador.GetAsync("/api/admin/publicadores")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Fixture.Factory.CreateClient().GetAsync("/api/admin/publicadores")).StatusCode);
    }
}
