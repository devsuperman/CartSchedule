using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using CartSchedule.Api.Tests.Infraestrutura;

namespace CartSchedule.Api.Tests.Autenticacao;

/// <summary>
/// Todo o site atrás do login (issue #49): rotas do publicador exigem token, o publicador fica
/// logado 180 dias (renovados ao abrir o app) e o administrador, 2 h. O relógio é o da fixture.
/// </summary>
public class SessaoTests(ApiFixture fixture) : ApiTestBase(fixture)
{
    private static DateTime Expiracao(JsonElement login) =>
        new JwtSecurityTokenHandler().ReadJwtToken(login.GetProperty("token").GetString()).ValidTo;

    private void Avancar(TimeSpan tempo) => Fixture.Relogio.Agora += tempo;

    public static TheoryData<string, string> RotasDoPublicador => new()
    {
        { "GET", "/api/janela" },
        { "GET", "/api/carrinhos" },
        { "GET", "/api/solicitacoes" },
        { "POST", "/api/solicitacoes" },
        { "DELETE", "/api/solicitacoes/1" },
        { "GET", "/api/eu" },
        { "POST", "/api/sessao/renovar" },
    };

    [Theory]
    [MemberData(nameof(RotasDoPublicador))]
    public async Task RotasDoPublicador_SemToken_Retornam401(string metodo, string rota)
    {
        var requisicao = new HttpRequestMessage(new HttpMethod(metodo), rota);
        if (metodo == "POST")
        {
            requisicao.Content = JsonContent.Create(new { carrinhoId = 1, diaSemana = Segunda, turnoId = Turno0810 });
        }

        var resposta = await Fixture.Factory.CreateClient().SendAsync(requisicao, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.Unauthorized, resposta.StatusCode);
    }

    [Fact]
    public async Task TokenAnonimoDoAparelho_NaoDaMaisAcesso()
    {
        var aparelho = Fixture.Factory.CreateClient();
        aparelho.DefaultRequestHeaders.Add("X-Publicador-Token", Guid.NewGuid().ToString());

        Assert.Equal(HttpStatusCode.Unauthorized, (await aparelho.GetAsync("/api/solicitacoes")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await aparelho.GetAsync("/api/carrinhos")).StatusCode);
    }

    [Fact]
    public async Task AtualizarNomePeloPublicador_NaoExisteMais()
    {
        var publicador = await PublicadorAsync();

        var resposta = await publicador.PutAsJsonAsync("/api/publicador", new { nome = "Outro" });

        Assert.Contains(resposta.StatusCode, new[] { HttpStatusCode.NotFound, HttpStatusCode.MethodNotAllowed });
    }

    [Fact]
    public async Task CorsNaoLiberaMaisOHeaderDoTokenAnonimo()
    {
        var preflight = new HttpRequestMessage(HttpMethod.Options, "/api/solicitacoes");
        preflight.Headers.Add("Origin", "http://localhost:3000");
        preflight.Headers.Add("Access-Control-Request-Method", "POST");
        preflight.Headers.Add("Access-Control-Request-Headers", "authorization,content-type");

        var resposta = await Fixture.Factory.CreateClient().SendAsync(preflight, TestContext.Current.CancellationToken);

        var liberados = string.Join(",", resposta.Headers.GetValues("Access-Control-Allow-Headers")).ToLowerInvariant();
        Assert.Contains("authorization", liberados);
        Assert.DoesNotContain("x-publicador-token", liberados);
    }

    [Fact]
    public async Task Eu_DevolveOsDadosDaConta()
    {
        var (id, pin) = await CriarContaAsync(await AdminAsync(), "Maria Souza", "Maria", administrador: true);
        var maria = ClienteComToken(await JsonAsync(await LoginAsync(Fixture.Factory.CreateClient(), "maria", pin)));

        var eu = await maria.GetFromJsonAsync<JsonElement>("/api/eu");

        Assert.Equal(["id", "nome", "usuario", "administrador"], eu.EnumerateObject().Select(p => p.Name));
        Assert.Equal(id, eu.GetProperty("id").GetGuid());
        Assert.Equal("Maria Souza", eu.GetProperty("nome").GetString());
        Assert.Equal("Maria", eu.GetProperty("usuario").GetString());
        Assert.True(eu.GetProperty("administrador").GetBoolean());
    }

    [Fact]
    public async Task Janela_AdministradorDeRecuperacaoTambemLe()
    {
        // A área administrativa tira da janela o mês da Escala (link e card do painel).
        var resposta = await (await AdminAsync()).GetAsync("/api/janela");

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);
    }

    [Fact]
    public async Task Eu_AdministradorDeRecuperacao_Retorna403()
    {
        Assert.Equal(HttpStatusCode.Forbidden, (await (await AdminAsync()).GetAsync("/api/eu")).StatusCode);
    }

    [Fact]
    public async Task TokenDoPublicador_Vale180Dias()
    {
        var publicador = await PublicadorAsync();

        Avancar(TimeSpan.FromDays(180) - TimeSpan.FromMinutes(5));
        Assert.Equal(HttpStatusCode.OK, (await publicador.GetAsync("/api/solicitacoes")).StatusCode);

        Avancar(TimeSpan.FromMinutes(10));
        Assert.Equal(HttpStatusCode.Unauthorized, (await publicador.GetAsync("/api/solicitacoes")).StatusCode);
    }

    [Fact]
    public async Task TokenDoAdministrador_Vale2Horas()
    {
        var admin = await AdminAsync();

        Avancar(TimeSpan.FromMinutes(115));
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync("/api/admin/carrinhos")).StatusCode);

        Avancar(TimeSpan.FromMinutes(10));
        Assert.Equal(HttpStatusCode.Unauthorized, (await admin.GetAsync("/api/admin/carrinhos")).StatusCode);
    }

    [Fact]
    public async Task Renovar_DevolveTokenComAValidadeCheia()
    {
        var publicador = await PublicadorAsync();
        Avancar(TimeSpan.FromDays(100));

        var resposta = await publicador.PostAsync("/api/sessao/renovar", null);

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);
        var corpo = await JsonAsync(resposta);
        Assert.Equal("publicador", corpo.GetProperty("papel").GetString());
        Assert.InRange(Expiracao(corpo) - Fixture.Relogio.Agora.UtcDateTime, TimeSpan.FromDays(179.9), TimeSpan.FromDays(180));

        // 200 dias depois do login: o token antigo expirou, o renovado continua valendo.
        Avancar(TimeSpan.FromDays(100));
        Assert.Equal(HttpStatusCode.Unauthorized, (await publicador.GetAsync("/api/solicitacoes")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await ClienteComToken(corpo).GetAsync("/api/solicitacoes")).StatusCode);
    }

    [Fact]
    public async Task Renovar_Administrador_Mais2HorasComPapelAtual()
    {
        var recuperacao = await AdminAsync();
        var (id, pin) = await CriarContaAsync(recuperacao, "Joao", "joao");
        var joao = ClienteComToken(await JsonAsync(await LoginAsync(Fixture.Factory.CreateClient(), "joao", pin)));
        // Ganhar a marca de administrador não desconecta: o papel novo vem na renovação.
        (await recuperacao.PutAsJsonAsync($"/api/admin/publicadores/{id}", new { administrador = true })).EnsureSuccessStatusCode();

        var corpo = await JsonAsync(await joao.PostAsync("/api/sessao/renovar", null));

        Assert.Equal("administrador", corpo.GetProperty("papel").GetString());
        Assert.InRange(Expiracao(corpo) - Fixture.Relogio.Agora.UtcDateTime, TimeSpan.FromMinutes(119), TimeSpan.FromMinutes(120));
        Assert.Equal(HttpStatusCode.OK, (await ClienteComToken(corpo).GetAsync("/api/admin/carrinhos")).StatusCode);
    }

    [Fact]
    public async Task Renovar_AdministradorDeRecuperacao_Retorna403()
    {
        Assert.Equal(HttpStatusCode.Forbidden, (await (await AdminAsync()).PostAsync("/api/sessao/renovar", null)).StatusCode);
    }

    [Fact]
    public async Task Renovar_ComTokenExpirado_Retorna401()
    {
        var publicador = await PublicadorAsync();
        Avancar(TimeSpan.FromDays(181));

        Assert.Equal(HttpStatusCode.Unauthorized, (await publicador.PostAsync("/api/sessao/renovar", null)).StatusCode);
    }

    [Fact]
    public async Task PublicadorComum_RecebeForbiddenNasRotasAdministrativas()
    {
        var publicador = await PublicadorAsync();

        foreach (var rota in new[] { "/api/admin/carrinhos", "/api/admin/publicadores", $"/api/admin/escalas/{MesAlvo}/grade" })
        {
            Assert.Equal(HttpStatusCode.Forbidden, (await publicador.GetAsync(rota)).StatusCode);
        }
    }
}
