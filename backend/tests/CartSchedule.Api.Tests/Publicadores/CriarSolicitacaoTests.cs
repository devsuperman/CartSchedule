using System.Net;
using System.Net.Http.Json;
using CartSchedule.Api.Tests.Infraestrutura;

namespace CartSchedule.Api.Tests.Publicadores;

public class CriarSolicitacaoTests(ApiFixture fixture) : ApiTestBase(fixture)
{
    private async Task<int> CarrinhoComSegunda0810ETerca1012Async()
    {
        var admin = await AdminAsync();
        var carrinhoId = await CriarCarrinhoAsync(admin);
        await DefinirTurnosAsync(admin, carrinhoId, (Segunda, Turno0810), (Terca, Turno1012));
        return carrinhoId;
    }

    [Fact]
    public async Task TurnoDisponivelNaqueleDia_Cria201SemStatus()
    {
        var carrinhoId = await CarrinhoComSegunda0810ETerca1012Async();

        var resposta = await SolicitarAsync(Publicador(), carrinhoId, Segunda, Turno0810);

        Assert.Equal(HttpStatusCode.Created, resposta.StatusCode);
        // Não há aprovação: toda solicitação já conta na escala (PLANNING.md regra 12a).
        Assert.False((await JsonAsync(resposta)).TryGetProperty("status", out _));
    }

    [Fact]
    public async Task TurnoDoCarrinhoMasDeOutroDia_Retorna400()
    {
        // Regra 17: 08–10 existe no carrinho, mas só na Segunda.
        var carrinhoId = await CarrinhoComSegunda0810ETerca1012Async();

        var resposta = await SolicitarAsync(Publicador(), carrinhoId, Terca, Turno0810);

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
    }

    [Fact]
    public async Task MesmaTrincaDuasVezes_Retorna409()
    {
        // Regra 4: duplicidade é o único bloqueio automático.
        var carrinhoId = await CarrinhoComSegunda0810ETerca1012Async();
        var publicador = Publicador();
        await SolicitarAsync(publicador, carrinhoId, Segunda, Turno0810);

        var resposta = await SolicitarAsync(publicador, carrinhoId, Segunda, Turno0810);

        Assert.Equal(HttpStatusCode.Conflict, resposta.StatusCode);
    }

    [Fact]
    public async Task TerceiroPublicadorNaMesmaTrinca_NaoEhBloqueado()
    {
        // Regra 3: o limite de 2 por trinca é só sinalizado, nunca bloqueado.
        var carrinhoId = await CarrinhoComSegunda0810ETerca1012Async();

        foreach (var nome in new[] { "Ana", "Bia", "Caio" })
        {
            var resposta = await SolicitarAsync(Publicador(), carrinhoId, Segunda, Turno0810, nome);
            Assert.Equal(HttpStatusCode.Created, resposta.StatusCode);
        }
    }

    [Fact]
    public async Task EnvioFechadoPeloAdmin_Retorna400ComCodigoJanelaFechada()
    {
        var carrinhoId = await CarrinhoComSegunda0810ETerca1012Async();
        (await AlterarEnvioAsync(await AdminAsync(), aberto: false)).EnsureSuccessStatusCode();

        var resposta = await SolicitarAsync(Publicador(), carrinhoId, Segunda, Turno0810);

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
        Assert.Equal("JANELA_FECHADA", (await JsonAsync(resposta)).GetProperty("codigo").GetString());
    }

    [Fact]
    public async Task EnvioReaberto_AceitaDeNovo()
    {
        var carrinhoId = await CarrinhoComSegunda0810ETerca1012Async();
        var admin = await AdminAsync();
        await AlterarEnvioAsync(admin, aberto: false);
        await AlterarEnvioAsync(admin, aberto: true);

        var resposta = await SolicitarAsync(Publicador(), carrinhoId, Segunda, Turno0810);

        Assert.Equal(HttpStatusCode.Created, resposta.StatusCode);
    }

    [Fact]
    public async Task Dia28SemOAdminFechar_ContinuaAberto()
    {
        // O fechamento não é mais automático no dia 27 (PLANNING.md §4).
        var carrinhoId = await CarrinhoComSegunda0810ETerca1012Async();
        Fixture.Relogio.Agora = new DateTimeOffset(2026, 9, 28, 15, 0, 0, TimeSpan.Zero);

        var resposta = await SolicitarAsync(Publicador(), carrinhoId, Segunda, Turno0810);

        Assert.Equal(HttpStatusCode.Created, resposta.StatusCode);
        Assert.Single(PedidosDaGrade(await GradeAsync(await AdminAsync(), "2026-10")));
    }

    [Fact]
    public async Task AntesDoDia15_SemOAdminFechar_VaiParaAEscalaDoMesCorrente()
    {
        // Em 05/10 a escala de Outubro (aberta em 15/09) segue em envio até o admin fechar.
        var carrinhoId = await CarrinhoComSegunda0810ETerca1012Async();
        Fixture.Relogio.Agora = new DateTimeOffset(2026, 10, 5, 15, 0, 0, TimeSpan.Zero);

        var resposta = await SolicitarAsync(Publicador(), carrinhoId, Segunda, Turno0810);

        Assert.Equal(HttpStatusCode.Created, resposta.StatusCode);
        Assert.Single(PedidosDaGrade(await GradeAsync(await AdminAsync(), "2026-10")));
    }

    [Fact]
    public async Task NoDia15_AbreAEscalaSeguinte_MesmoComAAnteriorFechada()
    {
        var carrinhoId = await CarrinhoComSegunda0810ETerca1012Async();
        var admin = await AdminAsync();
        await AlterarEnvioAsync(admin, aberto: false, mes: "2026-10");
        Fixture.Relogio.Agora = new DateTimeOffset(2026, 10, 15, 15, 0, 0, TimeSpan.Zero);

        var resposta = await SolicitarAsync(Publicador(), carrinhoId, Segunda, Turno0810);

        Assert.Equal(HttpStatusCode.Created, resposta.StatusCode);
        Assert.Single(PedidosDaGrade(await GradeAsync(admin, "2026-11")));
        Assert.Empty(PedidosDaGrade(await GradeAsync(admin, "2026-10")));
    }

    [Fact]
    public async Task SemTokenDoPublicador_Retorna400()
    {
        var carrinhoId = await CarrinhoComSegunda0810ETerca1012Async();

        var resposta = await Fixture.Factory.CreateClient().PostAsJsonAsync("/api/solicitacoes",
            new { nome = "Ana", carrinhoId, diaSemana = Segunda, turnoId = Turno0810 });

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
    }
}
