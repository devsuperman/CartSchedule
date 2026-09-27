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

        var resposta = await AdicionarManualAsync(admin, carrinhoId, Segunda, Turno0810, "Caio");

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

        var resposta = await AdicionarManualAsync(admin, carrinhoId, Terca, Turno0810, "Caio");

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
            var resposta = await AdicionarManualAsync(admin, carrinhoId, Segunda, Turno0810, nome);
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
            var resposta = await AdicionarComMarcaAsync(admin, carrinhoId, nome, marca);
            Assert.Equal(HttpStatusCode.Created, resposta.StatusCode);
        }
    }

    [Fact]
    public async Task CriancaOuIdoso_MarcaPublicadorNovo()
    {
        var admin = await AdminAsync();
        var carrinhoId = await CriarCarrinhoAsync(admin);
        await DefinirTurnosAsync(admin, carrinhoId, (Segunda, Turno0810));

        var resposta = await AdicionarComMarcaAsync(admin, carrinhoId, "Vô Zé", true);

        Assert.Equal(HttpStatusCode.Created, resposta.StatusCode);
        Assert.True((await JsonAsync(resposta)).GetProperty("criancaOuIdoso").GetBoolean());
        Assert.True(Assert.Single(PedidosDaGrade(await GradeAsync(admin))).GetProperty("criancaOuIdoso").GetBoolean());
    }

    [Fact]
    public async Task CriancaOuIdoso_MarcaPublicadorReusado_ENuncaDesmarca()
    {
        var admin = await AdminAsync();
        var carrinhoId = await CriarCarrinhoAsync(admin);
        await DefinirTurnosAsync(admin, carrinhoId, (Segunda, Turno0810), (Terca, Turno0810), (Quarta, Turno0810));
        await SolicitarAsync(Publicador(), carrinhoId, Segunda, Turno0810, "Vó Lia");

        await AdicionarComMarcaAsync(admin, carrinhoId, "Vó Lia", true, Terca);
        var semMarca = await AdicionarComMarcaAsync(admin, carrinhoId, "Vó Lia", false, Quarta);

        Assert.True((await JsonAsync(semMarca)).GetProperty("criancaOuIdoso").GetBoolean());
        var pedidos = PedidosDaGrade(await GradeAsync(admin));
        Assert.Equal(3, pedidos.Length);
        Assert.All(pedidos, p => Assert.True(p.GetProperty("criancaOuIdoso").GetBoolean()));
    }

    [Fact]
    public async Task SemMarca_PublicadorNovoNaoEhCriancaOuIdoso()
    {
        var admin = await AdminAsync();
        var carrinhoId = await CriarCarrinhoAsync(admin);
        await DefinirTurnosAsync(admin, carrinhoId, (Segunda, Turno0810));

        var resposta = await AdicionarManualAsync(admin, carrinhoId, Segunda, Turno0810, "Caio");

        Assert.False((await JsonAsync(resposta)).GetProperty("criancaOuIdoso").GetBoolean());
    }

    private static Task<HttpResponseMessage> AdicionarComMarcaAsync(
        HttpClient admin, int carrinhoId, string nome, bool criancaOuIdoso, int dia = Segunda) =>
        admin.PostAsJsonAsync(
            $"/api/admin/escalas/{MesAlvo}/solicitacoes",
            new { nome, carrinhoId, diaSemana = dia, turnoId = Turno0810, criancaOuIdoso });

    [Fact]
    public async Task MesmoNomeNaMesmaTrinca_Retorna409()
    {
        // Regra 9: nome igual reusa o publicador, então cai no bloqueio de duplicidade.
        var admin = await AdminAsync();
        var carrinhoId = await CriarCarrinhoAsync(admin);
        await DefinirTurnosAsync(admin, carrinhoId, (Segunda, Turno0810));
        await AdicionarManualAsync(admin, carrinhoId, Segunda, Turno0810, "Caio");

        var resposta = await AdicionarManualAsync(admin, carrinhoId, Segunda, Turno0810, "Caio");

        Assert.Equal(HttpStatusCode.Conflict, resposta.StatusCode);
    }

    [Fact]
    public async Task NomeDeHomonimos_ReusaOPublicadorDePedidoMaisAntigo()
    {
        // Regra 9: nomes repetidos são permitidos; entre homônimos, a adição manual usa sempre
        // o de pedido mais antigo.
        var admin = await AdminAsync();
        var carrinhoId = await CriarCarrinhoAsync(admin);
        await DefinirTurnosAsync(admin, carrinhoId, (Segunda, Turno0810), (Terca, Turno0810));
        var maisAntigo = Guid.NewGuid();
        await SolicitarAsync(Publicador(maisAntigo), carrinhoId, Segunda, Turno0810, "João");
        await SolicitarAsync(Publicador(), carrinhoId, Segunda, Turno0810, "João");

        var resposta = await AdicionarManualAsync(admin, carrinhoId, Terca, Turno0810, "João");

        Assert.Equal(maisAntigo, (await JsonAsync(resposta)).GetProperty("publicadorId").GetGuid());
    }

    [Fact]
    public async Task ForaDaJanelaEEmOutroMes_Funciona()
    {
        // Regra 7: o administrador não é limitado pela janela.
        var admin = await AdminAsync();
        var carrinhoId = await CriarCarrinhoAsync(admin);
        await DefinirTurnosAsync(admin, carrinhoId, (Segunda, Turno0810));
        Fixture.Relogio.Agora = new DateTimeOffset(2026, 9, 5, 15, 0, 0, TimeSpan.Zero);

        var resposta = await AdicionarManualAsync(admin, carrinhoId, Segunda, Turno0810, "Caio", mes: "2026-07");

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
