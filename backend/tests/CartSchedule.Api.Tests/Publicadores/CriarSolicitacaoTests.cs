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

        var resposta = await SolicitarAsync(await PublicadorAsync(), carrinhoId, Segunda, Turno0810);

        Assert.Equal(HttpStatusCode.Created, resposta.StatusCode);
        // Não há aprovação: toda solicitação já conta na escala (PLANNING.md regra 12a).
        Assert.False((await JsonAsync(resposta)).TryGetProperty("status", out _));
    }

    [Fact]
    public async Task TurnoDoCarrinhoMasDeOutroDia_Retorna400()
    {
        // Regra 17: 08–10 existe no carrinho, mas só na Segunda.
        var carrinhoId = await CarrinhoComSegunda0810ETerca1012Async();

        var resposta = await SolicitarAsync(await PublicadorAsync(), carrinhoId, Terca, Turno0810);

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
    }

    [Fact]
    public async Task MesmaTrincaDuasVezes_Retorna409()
    {
        // Regra 4: duplicidade é o único bloqueio automático.
        var carrinhoId = await CarrinhoComSegunda0810ETerca1012Async();
        var publicador = await PublicadorAsync();
        await SolicitarAsync(publicador, carrinhoId, Segunda, Turno0810);

        var resposta = await SolicitarAsync(publicador, carrinhoId, Segunda, Turno0810);

        Assert.Equal(HttpStatusCode.Conflict, resposta.StatusCode);
        Assert.Equal("HORARIO_OCUPADO", (await JsonAsync(resposta)).GetProperty("codigo").GetString());
    }

    /// <summary>Dois carrinhos com 08–10 na Segunda; o segundo também com 10–12 na Segunda.</summary>
    private async Task<(int Primeiro, int Segundo)> DoisCarrinhosNaSegunda0810Async()
    {
        var admin = await AdminAsync();
        var primeiro = await CriarCarrinhoAsync(admin, "Carrinho 01");
        var segundo = await CriarCarrinhoAsync(admin, "Carrinho 02");
        await DefinirTurnosAsync(admin, primeiro, (Segunda, Turno0810));
        await DefinirTurnosAsync(admin, segundo, (Segunda, Turno0810), (Segunda, Turno1012));
        return (primeiro, segundo);
    }

    [Fact]
    public async Task MesmoDiaETurnoEmOutroCarrinho_Retorna409HorarioOcupado()
    {
        // Regra 10: não dá para estar em dois carrinhos ao mesmo tempo.
        var (primeiro, segundo) = await DoisCarrinhosNaSegunda0810Async();
        var publicador = await PublicadorAsync();
        await SolicitarAsync(publicador, primeiro, Segunda, Turno0810);

        var resposta = await SolicitarAsync(publicador, segundo, Segunda, Turno0810);

        Assert.Equal(HttpStatusCode.Conflict, resposta.StatusCode);
        Assert.Equal("HORARIO_OCUPADO", (await JsonAsync(resposta)).GetProperty("codigo").GetString());
        Assert.Single(PedidosDaGrade(await GradeAsync(await AdminAsync())));
    }

    [Fact]
    public async Task MesmoDiaEmOutroTurno_EhAceito()
    {
        var (primeiro, segundo) = await DoisCarrinhosNaSegunda0810Async();
        var publicador = await PublicadorAsync();
        await SolicitarAsync(publicador, primeiro, Segunda, Turno0810);

        var resposta = await SolicitarAsync(publicador, segundo, Segunda, Turno1012);

        Assert.Equal(HttpStatusCode.Created, resposta.StatusCode);
    }

    [Fact]
    public async Task OutroPublicadorNoMesmoHorarioEmOutroCarrinho_EhAceito()
    {
        var (primeiro, segundo) = await DoisCarrinhosNaSegunda0810Async();
        await SolicitarAsync(await PublicadorAsync("Ana"), primeiro, Segunda, Turno0810);

        var resposta = await SolicitarAsync(await PublicadorAsync("Bia"), segundo, Segunda, Turno0810);

        Assert.Equal(HttpStatusCode.Created, resposta.StatusCode);
    }

    [Fact]
    public async Task HorarioOcupadoNaEscalaAnterior_NaoBloqueia()
    {
        var (primeiro, segundo) = await DoisCarrinhosNaSegunda0810Async();
        var publicador = await PublicadorAsync();
        Fixture.Relogio.Agora = new DateTimeOffset(2026, 9, 20, 12, 0, 0, TimeSpan.Zero);
        await SolicitarAsync(publicador, primeiro, Segunda, Turno0810);

        Fixture.Relogio.Agora = new DateTimeOffset(2026, 10, 20, 12, 0, 0, TimeSpan.Zero);
        var resposta = await SolicitarAsync(publicador, segundo, Segunda, Turno0810);

        Assert.Equal(HttpStatusCode.Created, resposta.StatusCode);
    }

    [Fact]
    public async Task DepoisDeExcluirOPedido_OHorarioVoltaAAceitar()
    {
        var (primeiro, segundo) = await DoisCarrinhosNaSegunda0810Async();
        var publicador = await PublicadorAsync();
        var criado = await JsonAsync(await SolicitarAsync(publicador, primeiro, Segunda, Turno0810));
        await publicador.DeleteAsync($"/api/solicitacoes/{criado.GetProperty("id").GetInt32()}");

        var resposta = await SolicitarAsync(publicador, segundo, Segunda, Turno0810);

        Assert.Equal(HttpStatusCode.Created, resposta.StatusCode);
    }

    [Fact]
    public async Task AdminAdicionaNoMesmoHorarioEmOutroCarrinho_NaoEhBloqueado()
    {
        // Regra 10: o horário ocupado só bloqueia o publicador; o admin é só avisado na tela.
        var (primeiro, segundo) = await DoisCarrinhosNaSegunda0810Async();
        var admin = await AdminAsync();
        await SolicitarAsync(await PublicadorAsync("Ana"), primeiro, Segunda, Turno0810);

        var resposta = await AdicionarRegistroAntigoPorNomeAsync(admin, segundo, Segunda, Turno0810, "Ana");

        Assert.Equal(HttpStatusCode.Created, resposta.StatusCode);
    }

    [Fact]
    public async Task TerceiroPublicadorNaMesmaTrinca_EhBloqueadoComVagaCheia()
    {
        // Regra 3: vaga com 2 pessoas é cheia para o publicador.
        var carrinhoId = await CarrinhoComSegunda0810ETerca1012Async();
        await SolicitarAsync(await PublicadorAsync("Ana"), carrinhoId, Segunda, Turno0810);
        await SolicitarAsync(await PublicadorAsync("Bia"), carrinhoId, Segunda, Turno0810);

        var resposta = await SolicitarAsync(await PublicadorAsync("Caio"), carrinhoId, Segunda, Turno0810);

        Assert.Equal(HttpStatusCode.Conflict, resposta.StatusCode);
        Assert.Equal("VAGA_CHEIA", (await JsonAsync(resposta)).GetProperty("codigo").GetString());
        Assert.Equal(2, PedidosDaGrade(await GradeAsync(await AdminAsync())).Length);
    }

    [Fact]
    public async Task AdminAdicionaNaVagaCheia_NaoEhBloqueado()
    {
        var carrinhoId = await CarrinhoComSegunda0810ETerca1012Async();
        var admin = await AdminAsync();
        await SolicitarAsync(await PublicadorAsync("Ana"), carrinhoId, Segunda, Turno0810);
        await SolicitarAsync(await PublicadorAsync("Bia"), carrinhoId, Segunda, Turno0810);

        var resposta = await AdicionarRegistroAntigoPorNomeAsync(admin, carrinhoId, Segunda, Turno0810, "Caio");

        Assert.Equal(HttpStatusCode.Created, resposta.StatusCode);
    }

    [Fact]
    public async Task VagaCheiaQueLibera_VoltaAAceitarPedidos()
    {
        var carrinhoId = await CarrinhoComSegunda0810ETerca1012Async();
        var admin = await AdminAsync();
        var primeiro = (await JsonAsync(await SolicitarAsync(await PublicadorAsync("Ana"), carrinhoId, Segunda, Turno0810)))
            .GetProperty("id").GetInt32();
        await SolicitarAsync(await PublicadorAsync("Bia"), carrinhoId, Segunda, Turno0810);
        await admin.DeleteAsync($"/api/admin/solicitacoes/{primeiro}");

        var resposta = await SolicitarAsync(await PublicadorAsync("Caio"), carrinhoId, Segunda, Turno0810);

        Assert.Equal(HttpStatusCode.Created, resposta.StatusCode);
    }

    [Fact]
    public async Task EnviosSimultaneosParaAUltimaVaga_SoUmPassa()
    {
        var carrinhoId = await CarrinhoComSegunda0810ETerca1012Async();
        await SolicitarAsync(await PublicadorAsync("Ana"), carrinhoId, Segunda, Turno0810);

        var pessoas = await Task.WhenAll(Enumerable.Range(0, 5).Select(i => PublicadorAsync($"Pessoa {i}")));

        var respostas = await Task.WhenAll(pessoas.Select(p => SolicitarAsync(p, carrinhoId, Segunda, Turno0810)));

        Assert.Equal(1, respostas.Count(r => r.StatusCode == HttpStatusCode.Created));
        Assert.Equal(2, PedidosDaGrade(await GradeAsync(await AdminAsync())).Length);
    }

    [Fact]
    public async Task PrimeirosEnviosSimultaneosDoMes_CriamUmaEscalaSemErro()
    {
        // Ninguém abriu a escala do mês ainda: todos os envios tentam criá-la ao mesmo tempo.
        var carrinhoId = await CarrinhoComSegunda0810ETerca1012Async();

        var pessoas = await Task.WhenAll(Enumerable.Range(0, 6).Select(i => PublicadorAsync($"Pessoa {i}")));

        var respostas = await Task.WhenAll(pessoas.Select(p => SolicitarAsync(p, carrinhoId, Segunda, Turno0810)));

        Assert.Equal(2, respostas.Count(r => r.StatusCode == HttpStatusCode.Created));
        Assert.Equal(4, respostas.Count(r => r.StatusCode == HttpStatusCode.Conflict));
    }

    [Fact]
    public async Task EnvioFechadoPeloAdmin_Retorna400ComCodigoJanelaFechada()
    {
        var carrinhoId = await CarrinhoComSegunda0810ETerca1012Async();
        (await AlterarEnvioAsync(await AdminAsync(), aberto: false)).EnsureSuccessStatusCode();

        var resposta = await SolicitarAsync(await PublicadorAsync(), carrinhoId, Segunda, Turno0810);

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

        var resposta = await SolicitarAsync(await PublicadorAsync(), carrinhoId, Segunda, Turno0810);

        Assert.Equal(HttpStatusCode.Created, resposta.StatusCode);
    }

    [Fact]
    public async Task Dia28SemOAdminFechar_ContinuaAberto()
    {
        // O fechamento não é mais automático no dia 27 (PLANNING.md §4).
        var carrinhoId = await CarrinhoComSegunda0810ETerca1012Async();
        Fixture.Relogio.Agora = new DateTimeOffset(2026, 9, 28, 15, 0, 0, TimeSpan.Zero);

        var resposta = await SolicitarAsync(await PublicadorAsync(), carrinhoId, Segunda, Turno0810);

        Assert.Equal(HttpStatusCode.Created, resposta.StatusCode);
        Assert.Single(PedidosDaGrade(await GradeAsync(await AdminAsync(), "2026-10")));
    }

    [Fact]
    public async Task AntesDoDia15_SemOAdminFechar_VaiParaAEscalaDoMesCorrente()
    {
        // Em 05/10 a escala de Outubro (aberta em 15/09) segue em envio até o admin fechar.
        var carrinhoId = await CarrinhoComSegunda0810ETerca1012Async();
        Fixture.Relogio.Agora = new DateTimeOffset(2026, 10, 5, 15, 0, 0, TimeSpan.Zero);

        var resposta = await SolicitarAsync(await PublicadorAsync(), carrinhoId, Segunda, Turno0810);

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
        admin = await AdminAsync(); // o token de 2 h do dia 20/09 já expirou

        var resposta = await SolicitarAsync(await PublicadorAsync(), carrinhoId, Segunda, Turno0810);

        Assert.Equal(HttpStatusCode.Created, resposta.StatusCode);
        Assert.Single(PedidosDaGrade(await GradeAsync(admin, "2026-11")));
        Assert.Empty(PedidosDaGrade(await GradeAsync(admin, "2026-10")));
    }

    [Fact]
    public async Task SemLogin_Retorna401()
    {
        var carrinhoId = await CarrinhoComSegunda0810ETerca1012Async();

        var resposta = await SolicitarAsync(Fixture.Factory.CreateClient(), carrinhoId, Segunda, Turno0810);

        Assert.Equal(HttpStatusCode.Unauthorized, resposta.StatusCode);
        Assert.Empty(PedidosDaGrade(await GradeAsync(await AdminAsync())));
    }

    [Fact]
    public async Task OPedidoLevaONomeDaConta()
    {
        // O nome não vai mais no pedido: um "nome" no corpo é ignorado.
        var carrinhoId = await CarrinhoComSegunda0810ETerca1012Async();
        var publicador = await PublicadorAsync("Maria Souza");

        var resposta = await publicador.PostAsJsonAsync("/api/solicitacoes",
            new { nome = "Outro Nome", carrinhoId, diaSemana = Segunda, turnoId = Turno0810 });

        Assert.Equal(HttpStatusCode.Created, resposta.StatusCode);
        var pedido = Assert.Single(PedidosDaGrade(await GradeAsync(await AdminAsync())));
        Assert.Equal("Maria Souza", pedido.GetProperty("publicadorNome").GetString());
    }

    [Fact]
    public async Task AdministradorDeRecuperacao_NaoPedeVaga_Retorna403()
    {
        var carrinhoId = await CarrinhoComSegunda0810ETerca1012Async();

        var resposta = await SolicitarAsync(await AdminAsync(), carrinhoId, Segunda, Turno0810);

        Assert.Equal(HttpStatusCode.Forbidden, resposta.StatusCode);
    }

    [Fact]
    public async Task PublicadorAdministrador_PedeVagaComoQualquerPublicador()
    {
        var carrinhoId = await CarrinhoComSegunda0810ETerca1012Async();
        var (_, pin) = await CriarContaAsync(await AdminAsync(), "Maria", "maria", administrador: true);
        var maria = ClienteComToken(await JsonAsync(await LoginAsync(Fixture.Factory.CreateClient(), "maria", pin)));

        Assert.Equal(HttpStatusCode.Created, (await SolicitarAsync(maria, carrinhoId, Segunda, Turno0810)).StatusCode);
    }
}
