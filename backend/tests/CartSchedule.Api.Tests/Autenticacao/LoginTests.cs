using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Json;
using CartSchedule.Api.Tests.Infraestrutura;

namespace CartSchedule.Api.Tests.Autenticacao;

/// <summary>
/// POST /api/login: um único login para o administrador de recuperação (credenciais do
/// servidor) e para os publicadores com conta (usuário + PIN).
/// </summary>
public class LoginTests(ApiFixture fixture) : ApiTestBase(fixture)
{
    private HttpClient Anonimo() => Fixture.Factory.CreateClient();

    private static DateTime Expiracao(System.Text.Json.JsonElement login) =>
        new JwtSecurityTokenHandler().ReadJwtToken(login.GetProperty("token").GetString()).ValidTo;

    [Fact]
    public async Task AdministradorDeRecuperacao_RecebeTokenDeAdministradorDe2Horas()
    {
        var resposta = await LoginAsync(Anonimo(), ApiFixture.AdminUsuario, ApiFixture.AdminSenha);

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);
        var corpo = await JsonAsync(resposta);
        Assert.Equal("recuperacao", corpo.GetProperty("papel").GetString());
        Assert.InRange(Expiracao(corpo) - DateTime.UtcNow, TimeSpan.FromMinutes(110), TimeSpan.FromMinutes(121));
        Assert.Equal(HttpStatusCode.OK, (await ClienteComToken(corpo).GetAsync("/api/admin/publicadores")).StatusCode);
    }

    [Fact]
    public async Task PublicadorAdministrador_EntraComUsuarioEPin_EAcessaAAreaAdministrativa()
    {
        var (_, pin) = await CriarContaAsync(await AdminAsync(), "Maria Souza", "maria", administrador: true);

        var resposta = await LoginAsync(Anonimo(), "maria", pin);

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);
        var corpo = await JsonAsync(resposta);
        Assert.Equal("administrador", corpo.GetProperty("papel").GetString());
        Assert.InRange(Expiracao(corpo) - DateTime.UtcNow, TimeSpan.FromMinutes(110), TimeSpan.FromMinutes(121));
        var admin = ClienteComToken(corpo);
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync("/api/admin/publicadores")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync("/api/admin/carrinhos")).StatusCode);
    }

    [Fact]
    public async Task UsuarioIgnoraMaiusculasEAcentos()
    {
        var (_, pin) = await CriarContaAsync(await AdminAsync(), "María", "María", administrador: true);

        Assert.Equal(HttpStatusCode.OK, (await LoginAsync(Anonimo(), " MARIA ", pin)).StatusCode);
    }

    [Fact]
    public async Task PublicadorComum_EntraMasNaoAcessaAAreaAdministrativa()
    {
        var (_, pin) = await CriarContaAsync(await AdminAsync(), "Joao", "joao");

        var resposta = await LoginAsync(Anonimo(), "joao", pin);

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);
        var corpo = await JsonAsync(resposta);
        Assert.Equal("publicador", corpo.GetProperty("papel").GetString());
        Assert.Equal(HttpStatusCode.Forbidden, (await ClienteComToken(corpo).GetAsync("/api/admin/carrinhos")).StatusCode);
    }

    [Fact]
    public async Task PinErrado_UsuarioInexistenteESenhaErradaDaRecuperacao_MesmaResposta401()
    {
        var (_, pin) = await CriarContaAsync(await AdminAsync(), "Joao", "joao", administrador: true);
        var pinErrado = pin == "9137" ? "9138" : "9137";

        foreach (var (usuario, segredo) in new[] { ("joao", pinErrado), ("ninguem", pin), (ApiFixture.AdminUsuario, "1234") })
        {
            var resposta = await LoginAsync(Anonimo(), usuario, segredo);

            Assert.Equal(HttpStatusCode.Unauthorized, resposta.StatusCode);
            Assert.Equal("CREDENCIAIS_INVALIDAS", (await JsonAsync(resposta)).GetProperty("codigo").GetString());
        }
    }

    [Fact]
    public async Task ContaSemPin_Retorna401CredenciaisInvalidas()
    {
        // Registro antigo (sem usuário/PIN): só existe pela adição manual por nome.
        var admin = await AdminAsync();
        var carrinhoId = await CriarCarrinhoAsync(admin);
        await DefinirTurnosAsync(admin, carrinhoId, (Segunda, Turno0810));
        await AdicionarManualAsync(admin, carrinhoId, Segunda, Turno0810, "Pedro");

        var resposta = await LoginAsync(Anonimo(), "Pedro", "");

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
        var semPin = await LoginAsync(Anonimo(), "Pedro", "1357");
        Assert.Equal(HttpStatusCode.Unauthorized, semPin.StatusCode);
        Assert.Equal("CREDENCIAIS_INVALIDAS", (await JsonAsync(semPin)).GetProperty("codigo").GetString());
    }

    [Fact]
    public async Task VariasFalhas_NaoBloqueiamAConta()
    {
        var (_, pin) = await CriarContaAsync(await AdminAsync(), "Joao", "joao", administrador: true);
        var pinErrado = pin == "9137" ? "9138" : "9137";

        for (var i = 0; i < 10; i++)
        {
            await LoginAsync(Anonimo(), "joao", pinErrado);
        }

        Assert.Equal(HttpStatusCode.OK, (await LoginAsync(Anonimo(), "joao", pin)).StatusCode);
    }

    [Fact]
    public async Task LoginAntigoDoAdmin_NaoExisteMais()
    {
        var resposta = await Anonimo().PostAsJsonAsync(
            "/api/admin/login", new { usuario = ApiFixture.AdminUsuario, senha = ApiFixture.AdminSenha });

        Assert.Equal(HttpStatusCode.NotFound, resposta.StatusCode);
    }
}
