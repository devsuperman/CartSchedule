using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using CartSchedule.Api.Tests.Infraestrutura;

namespace CartSchedule.Api.Tests.Administradores;

public class ExcluirSolicitacaoAdminTests(ApiFixture fixture) : ApiTestBase(fixture)
{
    private static int[] IdsDaCelula(JsonElement celula) =>
        celula.GetProperty("publicadores").EnumerateArray().Select(p => p.GetProperty("solicitacaoId").GetInt32()).ToArray();

    [Fact]
    public async Task TodaSolicitacaoApareceNaGrade_SemStatus()
    {
        var admin = await AdminAsync();
        var carrinhoId = await CriarCarrinhoAsync(admin);
        await DefinirTurnosAsync(admin, carrinhoId, (Segunda, Turno0810));
        await SolicitarAsync(Publicador(), carrinhoId, Segunda, Turno0810, "Ana");
        await AdicionarManualAsync(admin, carrinhoId, Segunda, Turno0810, "Bia");

        var grade = await GradeAsync(admin);
        Assert.All(PedidosDaGrade(grade), p => Assert.False(p.TryGetProperty("status", out _)));
        var celula = Assert.Single(grade.GetProperty("celulas").EnumerateArray());
        Assert.Equal(["Ana", "Bia"], celula.GetProperty("publicadores").EnumerateArray()
            .Select(p => p.GetProperty("publicadorNome").GetString()).Order());
    }

    [Fact]
    public async Task Excluir_ApagaERetiraDaCelula()
    {
        var admin = await AdminAsync();
        var carrinhoId = await CriarCarrinhoAsync(admin);
        await DefinirTurnosAsync(admin, carrinhoId, (Segunda, Turno0810));
        foreach (var nome in new[] { "Ana", "Bia", "Caio" })
        {
            await SolicitarAsync(Publicador(), carrinhoId, Segunda, Turno0810, nome);
        }

        var celula = Assert.Single((await GradeAsync(admin)).GetProperty("celulas").EnumerateArray());
        Assert.Equal(3, IdsDaCelula(celula).Length);
        var excluir = IdsDaCelula(celula)[0];

        var resposta = await admin.DeleteAsync($"/api/admin/solicitacoes/{excluir}");

        Assert.Equal(HttpStatusCode.NoContent, resposta.StatusCode);
        celula = Assert.Single((await GradeAsync(admin)).GetProperty("celulas").EnumerateArray());
        Assert.Equal(2, IdsDaCelula(celula).Length);
        Assert.DoesNotContain(excluir, IdsDaCelula(celula));
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
        Assert.Empty(PedidosDaGrade(await GradeAsync(admin, "2026-07")));
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
        Assert.Single(PedidosDaGrade(await GradeAsync(admin)));
    }
}
