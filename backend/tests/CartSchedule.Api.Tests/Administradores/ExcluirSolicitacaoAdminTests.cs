using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using CartSchedule.Api.Tests.Infraestrutura;

namespace CartSchedule.Api.Tests.Administradores;

public class ExcluirSolicitacaoAdminTests(ApiFixture fixture) : ApiTestBase(fixture)
{
    private static async Task<JsonElement> RevisaoAsync(HttpClient admin, string mes = MesAlvo) =>
        await admin.GetFromJsonAsync<JsonElement>($"/api/admin/escalas/{mes}/solicitacoes");

    private static int[] IdsDoGrupo(JsonElement grupo) =>
        grupo.GetProperty("solicitacoes").EnumerateArray().Select(s => s.GetProperty("id").GetInt32()).ToArray();

    [Fact]
    public async Task TodaSolicitacaoApareceNaRevisaoENaGrade_SemStatus()
    {
        var admin = await AdminAsync();
        var carrinhoId = await CriarCarrinhoAsync(admin);
        await DefinirTurnosAsync(admin, carrinhoId, (Segunda, Turno0810));
        await SolicitarAsync(Publicador(), carrinhoId, Segunda, Turno0810, "Ana");
        await AdicionarManualAsync(admin, carrinhoId, Segunda, Turno0810, "Bia");

        var grupo = Assert.Single((await RevisaoAsync(admin)).GetProperty("grupos").EnumerateArray());
        Assert.All(grupo.GetProperty("solicitacoes").EnumerateArray(),
            s => Assert.False(s.TryGetProperty("status", out _)));

        var grade = await admin.GetFromJsonAsync<JsonElement>($"/api/admin/escalas/{MesAlvo}/grade");
        var celula = Assert.Single(grade.GetProperty("celulas").EnumerateArray());
        Assert.Equal(["Ana", "Bia"], celula.GetProperty("publicadores").EnumerateArray()
            .Select(p => p.GetProperty("publicadorNome").GetString()).Order());
    }

    [Fact]
    public async Task Excluir_ApagaERetiraOExcedente()
    {
        var admin = await AdminAsync();
        var carrinhoId = await CriarCarrinhoAsync(admin);
        await DefinirTurnosAsync(admin, carrinhoId, (Segunda, Turno0810));
        foreach (var nome in new[] { "Ana", "Bia", "Caio" })
        {
            await SolicitarAsync(Publicador(), carrinhoId, Segunda, Turno0810, nome);
        }

        var grupo = Assert.Single((await RevisaoAsync(admin)).GetProperty("grupos").EnumerateArray());
        Assert.True(grupo.GetProperty("excedente").GetBoolean());
        var excluir = IdsDoGrupo(grupo)[0];

        var resposta = await admin.DeleteAsync($"/api/admin/solicitacoes/{excluir}");

        Assert.Equal(HttpStatusCode.NoContent, resposta.StatusCode);
        grupo = Assert.Single((await RevisaoAsync(admin)).GetProperty("grupos").EnumerateArray());
        Assert.False(grupo.GetProperty("excedente").GetBoolean());
        Assert.DoesNotContain(excluir, IdsDoGrupo(grupo));
    }

    [Fact]
    public async Task DepoisDeExcluido_PublicadorPodePedirAMesmaTrincaDeNovo()
    {
        var admin = await AdminAsync();
        var carrinhoId = await CriarCarrinhoAsync(admin);
        await DefinirTurnosAsync(admin, carrinhoId, (Segunda, Turno0810));
        var publicador = Publicador();
        var id = (await JsonAsync(await SolicitarAsync(publicador, carrinhoId, Segunda, Turno0810)))
            .GetProperty("id").GetInt32();

        await admin.DeleteAsync($"/api/admin/solicitacoes/{id}");

        Assert.Empty((await publicador.GetFromJsonAsync<JsonElement>("/api/solicitacoes")).EnumerateArray());
        Assert.Equal(HttpStatusCode.Created, (await SolicitarAsync(publicador, carrinhoId, Segunda, Turno0810)).StatusCode);
    }

    [Fact]
    public async Task ForaDaJanelaEEmOutroMes_Funciona()
    {
        // Regra 7: o administrador não é limitado pela janela.
        var admin = await AdminAsync();
        var carrinhoId = await CriarCarrinhoAsync(admin);
        await DefinirTurnosAsync(admin, carrinhoId, (Segunda, Turno0810));
        var id = (await JsonAsync(await AdicionarManualAsync(admin, carrinhoId, Segunda, Turno0810, "Caio", mes: "2026-07")))
            .GetProperty("id").GetInt32();
        Fixture.Relogio.Agora = new DateTimeOffset(2026, 9, 5, 15, 0, 0, TimeSpan.Zero);

        var resposta = await admin.DeleteAsync($"/api/admin/solicitacoes/{id}");

        Assert.Equal(HttpStatusCode.NoContent, resposta.StatusCode);
        Assert.Empty((await RevisaoAsync(admin, "2026-07")).GetProperty("grupos").EnumerateArray());
    }

    [Fact]
    public async Task Inexistente_Retorna404()
    {
        var admin = await AdminAsync();

        var resposta = await admin.DeleteAsync("/api/admin/solicitacoes/999999");

        Assert.Equal(HttpStatusCode.NotFound, resposta.StatusCode);
    }

    [Fact]
    public async Task SemLogin_Retorna401()
    {
        var admin = await AdminAsync();
        var carrinhoId = await CriarCarrinhoAsync(admin);
        await DefinirTurnosAsync(admin, carrinhoId, (Segunda, Turno0810));
        var id = (await JsonAsync(await SolicitarAsync(Publicador(), carrinhoId, Segunda, Turno0810)))
            .GetProperty("id").GetInt32();

        var resposta = await Fixture.Factory.CreateClient().DeleteAsync($"/api/admin/solicitacoes/{id}");

        Assert.Equal(HttpStatusCode.Unauthorized, resposta.StatusCode);
        Assert.Single((await RevisaoAsync(admin)).GetProperty("grupos").EnumerateArray());
    }
}
