using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using CartSchedule.Api.Tests.Infraestrutura;

namespace CartSchedule.Api.Tests.Administradores;

public class MoverSolicitacaoTests(ApiFixture fixture) : ApiTestBase(fixture)
{
    private static Task<HttpResponseMessage> MoverAsync(HttpClient client, int id, int carrinhoId, int dia, int turno) =>
        client.PatchAsJsonAsync($"/api/admin/solicitacoes/{id}", new { carrinhoId, diaSemana = dia, turnoId = turno });

    private static async Task<int> IdAsync(HttpResponseMessage resposta) =>
        (await JsonAsync(resposta)).GetProperty("id").GetInt32();

    private static JsonElement Celula(JsonElement grade, int carrinhoId, int dia, int turno) =>
        grade.GetProperty("celulas").EnumerateArray().Single(c =>
            c.GetProperty("carrinhoId").GetInt32() == carrinhoId
            && c.GetProperty("diaSemana").GetInt32() == dia
            && c.GetProperty("turnoId").GetInt32() == turno);

    private static string?[] Nomes(JsonElement celula) =>
        celula.GetProperty("publicadores").EnumerateArray().Select(p => p.GetProperty("publicadorNome").GetString()).ToArray();

    [Fact]
    public async Task Move_ParaOutroCarrinhoDiaETurno_MantendoIdEOrigem()
    {
        var admin = await AdminAsync();
        var carrinho1 = await CriarCarrinhoAsync(admin, "Carrinho 01");
        var carrinho2 = await CriarCarrinhoAsync(admin, "Carrinho 02");
        await DefinirTurnosAsync(admin, carrinho1, (Segunda, Turno0810));
        await DefinirTurnosAsync(admin, carrinho2, (Terca, Turno1012));
        var publicador = Publicador();
        var id = await IdAsync(await SolicitarAsync(publicador, carrinho1, Segunda, Turno0810, "Ana"));

        var resposta = await MoverAsync(admin, id, carrinho2, Terca, Turno1012);

        Assert.Equal(HttpStatusCode.NoContent, resposta.StatusCode);
        var grade = await GradeAsync(admin);
        Assert.Empty(Nomes(Celula(grade, carrinho1, Segunda, Turno0810)));
        var movido = Assert.Single(Celula(grade, carrinho2, Terca, Turno1012).GetProperty("publicadores").EnumerateArray());
        Assert.Equal(id, movido.GetProperty("solicitacaoId").GetInt32());
        Assert.Equal(1, movido.GetProperty("origem").GetInt32()); // continua "Publicador"

        // O publicador vê o pedido já na vaga nova, no histórico dele.
        var historico = Assert.Single((await publicador.GetFromJsonAsync<JsonElement>("/api/solicitacoes")).EnumerateArray());
        Assert.Equal(carrinho2, historico.GetProperty("carrinhoId").GetInt32());
        Assert.Equal(Terca, historico.GetProperty("diaSemana").GetInt32());
    }

    [Fact]
    public async Task ParaVagaComDuasPessoas_NaoBloqueia()
    {
        // O limite de 2 é só sinalização (regra 3).
        var admin = await AdminAsync();
        var carrinhoId = await CriarCarrinhoAsync(admin);
        await DefinirTurnosAsync(admin, carrinhoId, (Segunda, Turno0810), (Segunda, Turno1012));
        await AdicionarManualAsync(admin, carrinhoId, Segunda, Turno1012, "Bia");
        await AdicionarManualAsync(admin, carrinhoId, Segunda, Turno1012, "Caio");
        var id = await IdAsync(await AdicionarManualAsync(admin, carrinhoId, Segunda, Turno0810, "Ana"));

        var resposta = await MoverAsync(admin, id, carrinhoId, Segunda, Turno1012);

        Assert.Equal(HttpStatusCode.NoContent, resposta.StatusCode);
        Assert.Equal(3, Nomes(Celula(await GradeAsync(admin), carrinhoId, Segunda, Turno1012)).Length);
    }

    [Fact]
    public async Task DestinoNaoConfiguradoNoDia_Retorna400()
    {
        var admin = await AdminAsync();
        var carrinhoId = await CriarCarrinhoAsync(admin);
        await DefinirTurnosAsync(admin, carrinhoId, (Segunda, Turno0810), (Terca, Turno1012));
        var id = await IdAsync(await AdicionarManualAsync(admin, carrinhoId, Segunda, Turno0810, "Ana"));

        var resposta = await MoverAsync(admin, id, carrinhoId, Segunda, Turno1012);

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
        Assert.Equal(["Ana"], Nomes(Celula(await GradeAsync(admin), carrinhoId, Segunda, Turno0810)));
    }

    [Fact]
    public async Task PublicadorJaTemPedidoNoDestino_Retorna409()
    {
        var admin = await AdminAsync();
        var carrinhoId = await CriarCarrinhoAsync(admin);
        await DefinirTurnosAsync(admin, carrinhoId, (Segunda, Turno0810), (Segunda, Turno1012));
        var publicador = Publicador();
        var id = await IdAsync(await SolicitarAsync(publicador, carrinhoId, Segunda, Turno0810));
        await SolicitarAsync(publicador, carrinhoId, Segunda, Turno1012);

        var resposta = await MoverAsync(admin, id, carrinhoId, Segunda, Turno1012);

        Assert.Equal(HttpStatusCode.Conflict, resposta.StatusCode);
    }

    [Fact]
    public async Task ParaAMesmaVaga_Retorna204SemMudar()
    {
        var admin = await AdminAsync();
        var carrinhoId = await CriarCarrinhoAsync(admin);
        await DefinirTurnosAsync(admin, carrinhoId, (Segunda, Turno0810));
        var id = await IdAsync(await AdicionarManualAsync(admin, carrinhoId, Segunda, Turno0810, "Ana"));

        var resposta = await MoverAsync(admin, id, carrinhoId, Segunda, Turno0810);

        Assert.Equal(HttpStatusCode.NoContent, resposta.StatusCode);
        Assert.Equal(["Ana"], Nomes(Celula(await GradeAsync(admin), carrinhoId, Segunda, Turno0810)));
    }

    [Fact]
    public async Task ForaDaJanelaEEmMesPassado_Funciona()
    {
        // Regra 7: o administrador não é limitado pela janela.
        var admin = await AdminAsync();
        var carrinhoId = await CriarCarrinhoAsync(admin);
        await DefinirTurnosAsync(admin, carrinhoId, (Segunda, Turno0810), (Quarta, Turno0608));
        var id = await IdAsync(await AdicionarManualAsync(admin, carrinhoId, Segunda, Turno0810, "Ana", mes: "2026-07"));
        Fixture.Relogio.Agora = new DateTimeOffset(2026, 9, 5, 15, 0, 0, TimeSpan.Zero);

        var resposta = await MoverAsync(admin, id, carrinhoId, Quarta, Turno0608);

        Assert.Equal(HttpStatusCode.NoContent, resposta.StatusCode);
        Assert.Equal(["Ana"], Nomes(Celula(await GradeAsync(admin, "2026-07"), carrinhoId, Quarta, Turno0608)));
    }

    [Fact]
    public async Task Inexistente_Retorna404()
    {
        var admin = await AdminAsync();
        var carrinhoId = await CriarCarrinhoAsync(admin);
        await DefinirTurnosAsync(admin, carrinhoId, (Segunda, Turno0810));

        var resposta = await MoverAsync(admin, 999999, carrinhoId, Segunda, Turno0810);

        Assert.Equal(HttpStatusCode.NotFound, resposta.StatusCode);
    }

    [Fact]
    public async Task SemLogin_Retorna401()
    {
        var admin = await AdminAsync();
        var carrinhoId = await CriarCarrinhoAsync(admin);
        await DefinirTurnosAsync(admin, carrinhoId, (Segunda, Turno0810), (Terca, Turno0810));
        var id = await IdAsync(await AdicionarManualAsync(admin, carrinhoId, Segunda, Turno0810, "Ana"));

        var resposta = await MoverAsync(Fixture.Factory.CreateClient(), id, carrinhoId, Terca, Turno0810);

        Assert.Equal(HttpStatusCode.Unauthorized, resposta.StatusCode);
        Assert.Equal(["Ana"], Nomes(Celula(await GradeAsync(admin), carrinhoId, Segunda, Turno0810)));
    }
}
