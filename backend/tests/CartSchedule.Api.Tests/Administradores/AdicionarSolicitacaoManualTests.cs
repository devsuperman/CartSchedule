using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using CartSchedule.Api.Tests.Infraestrutura;

namespace CartSchedule.Api.Tests.Administradores;

public class AdicionarSolicitacaoManualTests(ApiFixture fixture) : ApiTestBase(fixture)
{
    [Fact]
    public async Task TurnoDisponivelNaqueleDia_JaContaNaEscala()
    {
        var admin = await AdminAsync();
        var carrinhoId = await CriarCarrinhoAsync(admin);
        await DefinirTurnosAsync(admin, carrinhoId, (Segunda, Turno0810));

        var resposta = await AdicionarRegistroAntigoAsync(admin, carrinhoId, Segunda, Turno0810, "Caio");

        Assert.Equal(HttpStatusCode.Created, resposta.StatusCode);
        Assert.False((await JsonAsync(resposta)).TryGetProperty("status", out _));
        var grade = await admin.GetFromJsonAsync<JsonElement>($"/api/admin/escalas/{MesAlvo}/grade");
        var celula = Assert.Single(grade.GetProperty("celulas").EnumerateArray());
        Assert.Equal("Caio", Assert.Single(celula.GetProperty("publicadores").EnumerateArray()).GetProperty("publicadorNome").GetString());
    }

    [Fact]
    public async Task TurnoDoCarrinhoMasDeOutroDia_Retorna400()
    {
        var admin = await AdminAsync();
        var carrinhoId = await CriarCarrinhoAsync(admin);
        await DefinirTurnosAsync(admin, carrinhoId, (Segunda, Turno0810), (Terca, Turno1012));

        var resposta = await AdicionarRegistroAntigoAsync(admin, carrinhoId, Terca, Turno0810, "Caio");

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
    }

    [Fact]
    public async Task TerceiraPessoaNaTrinca_NaoEhBloqueada()
    {
        var admin = await AdminAsync();
        var carrinhoId = await CriarCarrinhoAsync(admin);
        await DefinirTurnosAsync(admin, carrinhoId, (Segunda, Turno0810));

        foreach (var nome in new[] { "Ana", "Bia", "Caio" })
        {
            var resposta = await AdicionarRegistroAntigoAsync(admin, carrinhoId, Segunda, Turno0810, nome);
            Assert.Equal(HttpStatusCode.Created, resposta.StatusCode);
        }
    }

    [Fact]
    public async Task QuartaPessoaComCriancaOuIdoso_NaoEhBloqueada()
    {
        // Regra 1: a meta é 3 com criança/idoso, mas nem 3 nem 4 são bloqueados.
        var admin = await AdminAsync();
        var carrinhoId = await CriarCarrinhoAsync(admin);
        await DefinirTurnosAsync(admin, carrinhoId, (Segunda, Turno0810));

        foreach (var (nome, marca) in new[] { ("Ana", false), ("Bia", false), ("Vô Zé", true), ("Caio", false) })
        {
            var id = await RegistroAntigoAsync(nome, marca);
            var resposta = await AdicionarParaAsync(admin, carrinhoId, Segunda, Turno0810, id);
            Assert.Equal(HttpStatusCode.Created, resposta.StatusCode);
        }
    }

    [Fact]
    public async Task PublicadorComConta_EntraNaVagaComNomeEMarcaDaConta()
    {
        var admin = await AdminAsync();
        var carrinhoId = await CriarCarrinhoAsync(admin);
        await DefinirTurnosAsync(admin, carrinhoId, (Segunda, Turno0810));
        var (id, _) = await CriarContaAsync(admin, "Vô Zé", "ze", criancaOuIdoso: true);

        var resposta = await AdicionarParaAsync(admin, carrinhoId, Segunda, Turno0810, id);

        Assert.Equal(HttpStatusCode.Created, resposta.StatusCode);
        var corpo = await JsonAsync(resposta);
        Assert.Equal(id, corpo.GetProperty("publicadorId").GetGuid());
        Assert.Equal("Vô Zé", corpo.GetProperty("publicadorNome").GetString());
        Assert.True(corpo.GetProperty("criancaOuIdoso").GetBoolean());
        var pedido = Assert.Single(PedidosDaGrade(await GradeAsync(admin)));
        Assert.Equal(id, pedido.GetProperty("publicadorId").GetGuid());
        Assert.True(pedido.GetProperty("criancaOuIdoso").GetBoolean());
    }

    [Fact]
    public async Task PublicadorInexistente_Retorna400ENaoCriaNinguem()
    {
        var admin = await AdminAsync();
        var carrinhoId = await CriarCarrinhoAsync(admin);
        await DefinirTurnosAsync(admin, carrinhoId, (Segunda, Turno0810));

        var resposta = await AdicionarParaAsync(admin, carrinhoId, Segunda, Turno0810, Guid.NewGuid());

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
        Assert.Empty(PedidosDaGrade(await GradeAsync(admin)));
        Assert.Empty((await admin.GetFromJsonAsync<JsonElement>("/api/admin/publicadores?incluirInativos=true")).EnumerateArray());
    }

    [Fact]
    public async Task PublicadorDesativado_Retorna400()
    {
        var admin = await AdminAsync();
        var carrinhoId = await CriarCarrinhoAsync(admin);
        await DefinirTurnosAsync(admin, carrinhoId, (Segunda, Turno0810));
        var (id, _) = await CriarContaAsync(admin, "Pedro", "pedro");
        (await admin.PutAsJsonAsync($"/api/admin/publicadores/{id}", new { ativo = false })).EnsureSuccessStatusCode();

        var resposta = await AdicionarParaAsync(admin, carrinhoId, Segunda, Turno0810, id);

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
        Assert.Empty(PedidosDaGrade(await GradeAsync(admin)));
    }

    [Fact]
    public async Task NomeLivre_Retorna400ENaoCriaPublicador()
    {
        // Contrato antigo ({ nome }): sem publicadorId o pedido é inválido.
        var admin = await AdminAsync();
        var carrinhoId = await CriarCarrinhoAsync(admin);
        await DefinirTurnosAsync(admin, carrinhoId, (Segunda, Turno0810));

        var resposta = await admin.PostAsJsonAsync(
            $"/api/admin/escalas/{MesAlvo}/solicitacoes",
            new { nome = "Caio", carrinhoId, diaSemana = Segunda, turnoId = Turno0810 });

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
        Assert.Empty((await admin.GetFromJsonAsync<JsonElement>("/api/admin/publicadores?incluirInativos=true")).EnumerateArray());
    }

    [Fact]
    public async Task MesmoPublicadorNaMesmaTrinca_Retorna409()
    {
        var admin = await AdminAsync();
        var carrinhoId = await CriarCarrinhoAsync(admin);
        await DefinirTurnosAsync(admin, carrinhoId, (Segunda, Turno0810));
        var (id, _) = await CriarContaAsync(admin, "Caio", "caio");
        await AdicionarParaAsync(admin, carrinhoId, Segunda, Turno0810, id);

        var resposta = await AdicionarParaAsync(admin, carrinhoId, Segunda, Turno0810, id);

        Assert.Equal(HttpStatusCode.Conflict, resposta.StatusCode);
    }

    [Fact]
    public async Task MesmoHorarioEmOutroCarrinho_NaoEhBloqueado()
    {
        // Regra 10: para o administrador, horário ocupado só é avisado (na tela).
        var admin = await AdminAsync();
        var primeiro = await CriarCarrinhoAsync(admin, "Carrinho 01");
        var segundo = await CriarCarrinhoAsync(admin, "Carrinho 02");
        await DefinirTurnosAsync(admin, primeiro, (Segunda, Turno0810));
        await DefinirTurnosAsync(admin, segundo, (Segunda, Turno0810));
        var (id, _) = await CriarContaAsync(admin, "Caio", "caio");
        await AdicionarParaAsync(admin, primeiro, Segunda, Turno0810, id);

        var resposta = await AdicionarParaAsync(admin, segundo, Segunda, Turno0810, id);

        Assert.Equal(HttpStatusCode.Created, resposta.StatusCode);
    }

    [Fact]
    public async Task ForaDaJanelaEEmOutroMes_Funciona()
    {
        // Regra 7: o administrador não é limitado pela janela.
        var admin = await AdminAsync();
        var carrinhoId = await CriarCarrinhoAsync(admin);
        await DefinirTurnosAsync(admin, carrinhoId, (Segunda, Turno0810));
        Fixture.Relogio.Agora = new DateTimeOffset(2026, 9, 5, 15, 0, 0, TimeSpan.Zero);

        var resposta = await AdicionarRegistroAntigoAsync(admin, carrinhoId, Segunda, Turno0810, "Caio", mes: "2026-07");

        Assert.Equal(HttpStatusCode.Created, resposta.StatusCode);
    }

    [Fact]
    public async Task RemoverTurnoDoCarrinho_NaoApagaSolicitacoesExistentes()
    {
        // Regra 18: mudar a configuração só afeta novos envios.
        var admin = await AdminAsync();
        var carrinhoId = await CriarCarrinhoAsync(admin);
        await DefinirTurnosAsync(admin, carrinhoId, (Segunda, Turno0810));
        var publicador = Publicador();
        await SolicitarAsync(publicador, carrinhoId, Segunda, Turno0810);

        await DefinirTurnosAsync(admin, carrinhoId);

        var historico = await publicador.GetFromJsonAsync<JsonElement>("/api/solicitacoes");
        Assert.Single(historico.EnumerateArray());
        Assert.Equal(HttpStatusCode.BadRequest, (await SolicitarAsync(Publicador(), carrinhoId, Segunda, Turno0810)).StatusCode);
    }
}
