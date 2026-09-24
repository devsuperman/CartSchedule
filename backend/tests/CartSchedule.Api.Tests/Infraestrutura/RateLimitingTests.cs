using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace CartSchedule.Api.Tests.Infraestrutura;

/// <summary>
/// Proteção contra bots/força bruta sem exigir login do publicador: limites por IP.
/// Cada teste sobe um host próprio com limites baixos (o da fixture tem limites altos)
/// e identifica o cliente pelo X-Forwarded-For, como o nginx faz em produção.
/// </summary>
public class RateLimitingTests(ApiFixture fixture) : ApiTestBase(fixture)
{
    private WebApplicationFactory<Program> HostComLimites(int login = 100, int escrita = 100, int global = 100) =>
        Fixture.Factory.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("RateLimit:LoginPor15Minutos", login.ToString());
            builder.UseSetting("RateLimit:EscritaPublicadorPorMinuto", escrita.ToString());
            builder.UseSetting("RateLimit:GlobalPorMinuto", global.ToString());
        });

    private static HttpClient ClienteDoIp(WebApplicationFactory<Program> host, string ip)
    {
        var client = host.CreateClient();
        client.DefaultRequestHeaders.Add("X-Forwarded-For", ip);
        client.DefaultRequestHeaders.Add("X-Publicador-Token", Guid.NewGuid().ToString());
        return client;
    }

    private static Task<HttpResponseMessage> LoginErradoAsync(HttpClient client) =>
        client.PostAsJsonAsync("/api/admin/login", new { usuario = "admin", senha = "errada" }, TestContext.Current.CancellationToken);

    [Fact]
    public async Task LoginAcimaDoLimite_Retorna429ComCodigoERetryAfter()
    {
        await using var host = HostComLimites(login: 3);
        var client = ClienteDoIp(host, "203.0.113.10");

        for (var i = 0; i < 3; i++)
        {
            Assert.Equal(HttpStatusCode.Unauthorized, (await LoginErradoAsync(client)).StatusCode);
        }

        var resposta = await LoginErradoAsync(client);

        Assert.Equal(HttpStatusCode.TooManyRequests, resposta.StatusCode);
        Assert.Equal("MUITAS_REQUISICOES", (await JsonAsync(resposta)).GetProperty("codigo").GetString());
        Assert.NotNull(resposta.Headers.RetryAfter);
    }

    [Fact]
    public async Task LimiteEhPorIp_OutroIpContinuaLiberado()
    {
        await using var host = HostComLimites(login: 1);
        var atacante = ClienteDoIp(host, "203.0.113.20");
        await LoginErradoAsync(atacante);
        Assert.Equal(HttpStatusCode.TooManyRequests, (await LoginErradoAsync(atacante)).StatusCode);

        var outro = ClienteDoIp(host, "198.51.100.7");
        var resposta = await outro.PostAsJsonAsync(
            "/api/admin/login",
            new { usuario = ApiFixture.AdminUsuario, senha = ApiFixture.AdminSenha },
            TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);
    }

    [Fact]
    public async Task EnvioDeSolicitacoesAcimaDoLimite_Retorna429()
    {
        var admin = await AdminAsync();
        var carrinhoId = await CriarCarrinhoAsync(admin);
        await DefinirTurnosAsync(admin, carrinhoId, (Segunda, Turno0810), (Terca, Turno1012), (Quarta, Turno1416));

        await using var host = HostComLimites(escrita: 2);
        var bot = ClienteDoIp(host, "203.0.113.30");

        Assert.Equal(HttpStatusCode.Created, (await SolicitarAsync(bot, carrinhoId, Segunda, Turno0810)).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await SolicitarAsync(bot, carrinhoId, Terca, Turno1012)).StatusCode);

        var resposta = await SolicitarAsync(bot, carrinhoId, Quarta, Turno1416);

        Assert.Equal(HttpStatusCode.TooManyRequests, resposta.StatusCode);
        Assert.Equal("MUITAS_REQUISICOES", (await JsonAsync(resposta)).GetProperty("codigo").GetString());
    }

    [Fact]
    public async Task LimiteGlobal_ValeParaApiMasNaoParaHealth()
    {
        await using var host = HostComLimites(global: 2);
        var client = ClienteDoIp(host, "203.0.113.40");
        var ct = TestContext.Current.CancellationToken;

        await client.GetAsync("/api/janela", ct);
        await client.GetAsync("/api/janela", ct);
        Assert.Equal(HttpStatusCode.TooManyRequests, (await client.GetAsync("/api/janela", ct)).StatusCode);

        for (var i = 0; i < 5; i++)
        {
            Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/health", ct)).StatusCode);
        }
    }
}
