using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using CartSchedule.Api.Tests.Infraestrutura;

namespace CartSchedule.Api.Tests.Publicadores;

public class AtualizarNomeTests(ApiFixture fixture) : ApiTestBase(fixture)
{
    private static Task<HttpResponseMessage> AtualizarNomeAsync(HttpClient publicador, string nome) =>
        publicador.PutAsJsonAsync("/api/publicador", new { nome });

    private static async Task<string?[]> NomesNaRevisaoAsync(HttpClient admin) =>
        (await admin.GetFromJsonAsync<JsonElement>($"/api/admin/escalas/{MesAlvo}/solicitacoes"))
            .GetProperty("grupos").EnumerateArray()
            .SelectMany(g => g.GetProperty("solicitacoes").EnumerateArray())
            .Select(s => s.GetProperty("publicadorNome").GetString())
            .ToArray();

    [Fact]
    public async Task AtualizaNaHora_AdminVeONomeNovo()
    {
        var admin = await AdminAsync();
        var carrinhoId = await CriarCarrinhoAsync(admin);
        await DefinirTurnosAsync(admin, carrinhoId, (Segunda, Turno0810));
        var publicador = Publicador();
        await SolicitarAsync(publicador, carrinhoId, Segunda, Turno0810, "Joao");

        var resposta = await AtualizarNomeAsync(publicador, "  João Silva ");

        Assert.Equal(HttpStatusCode.NoContent, resposta.StatusCode);
        Assert.Equal(["João Silva"], await NomesNaRevisaoAsync(admin));
    }

    [Fact]
    public async Task SemPedidoAinda_Retorna204ENaoCriaPublicador()
    {
        var token = Guid.NewGuid();

        var resposta = await AtualizarNomeAsync(Publicador(token), "Ana");

        Assert.Equal(HttpStatusCode.NoContent, resposta.StatusCode);
        // Se o PUT tivesse criado o publicador, a adição manual de "Ana" o reusaria.
        var admin = await AdminAsync();
        var carrinhoId = await CriarCarrinhoAsync(admin);
        await DefinirTurnosAsync(admin, carrinhoId, (Segunda, Turno0810));
        var criada = await JsonAsync(await AdicionarManualAsync(admin, carrinhoId, Segunda, Turno0810, "Ana"));
        Assert.NotEqual(token, criada.GetProperty("publicadorId").GetGuid());
    }

    [Fact]
    public async Task ComJanelaFechada_Funciona()
    {
        var admin = await AdminAsync();
        var carrinhoId = await CriarCarrinhoAsync(admin);
        await DefinirTurnosAsync(admin, carrinhoId, (Segunda, Turno0810));
        var publicador = Publicador();
        await SolicitarAsync(publicador, carrinhoId, Segunda, Turno0810, "Joao");
        Fixture.Relogio.Agora = new DateTimeOffset(2026, 9, 28, 15, 0, 0, TimeSpan.Zero);

        var resposta = await AtualizarNomeAsync(publicador, "João");

        Assert.Equal(HttpStatusCode.NoContent, resposta.StatusCode);
        Assert.Equal(["João"], await NomesNaRevisaoAsync(admin));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task NomeVazio_Retorna400(string nome)
    {
        Assert.Equal(HttpStatusCode.BadRequest, (await AtualizarNomeAsync(Publicador(), nome)).StatusCode);
    }

    [Fact]
    public async Task NomeLongoDemais_Retorna400()
    {
        Assert.Equal(HttpStatusCode.BadRequest, (await AtualizarNomeAsync(Publicador(), new string('a', 201))).StatusCode);
    }

    [Fact]
    public async Task SemToken_Retorna400()
    {
        var resposta = await Fixture.Factory.CreateClient().PutAsJsonAsync("/api/publicador", new { nome = "Ana" });

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
    }
}
