using System.Net.Http.Json;
using System.Text.Json;
using CartSchedule.Api.Tests.Infraestrutura;

namespace CartSchedule.Api.Tests.Administradores;

public class ObterEscalaFinalTests(ApiFixture fixture) : ApiTestBase(fixture)
{
    private static (int Carrinho, int Dia, int Turno, bool Disponivel, int Pessoas)[] Celulas(JsonElement grade) =>
        grade.GetProperty("celulas").EnumerateArray()
            .Select(c => (
                c.GetProperty("carrinhoId").GetInt32(),
                c.GetProperty("diaSemana").GetInt32(),
                c.GetProperty("turnoId").GetInt32(),
                c.GetProperty("disponivel").GetBoolean(),
                c.GetProperty("publicadores").GetArrayLength()))
            .ToArray();

    [Fact]
    public async Task SemPedidos_MostraAsVagasConfiguradasVazias_SemCriarAEscala()
    {
        var admin = await AdminAsync();
        var carrinhoId = await CriarCarrinhoAsync(admin);
        await DefinirTurnosAsync(admin, carrinhoId, (Segunda, Turno0810), (Terca, Turno1012));

        var grade = await GradeAsync(admin);

        Assert.Equal(
            [(carrinhoId, Segunda, Turno0810, true, 0), (carrinhoId, Terca, Turno1012, true, 0)],
            Celulas(grade));
    }

    [Fact]
    public async Task CarrinhoInativo_NaoMostraVagasVazias_MasMantemOsPedidosComoIndisponiveis()
    {
        // Regra 10: desativar o carrinho ou tirar o turno nunca apaga pedidos existentes.
        var admin = await AdminAsync();
        var ativo = await CriarCarrinhoAsync(admin, "Carrinho 01");
        var inativo = await CriarCarrinhoAsync(admin, "Carrinho 02");
        await DefinirTurnosAsync(admin, ativo, (Segunda, Turno0810), (Segunda, Turno1012));
        await DefinirTurnosAsync(admin, inativo, (Segunda, Turno0810), (Terca, Turno0810));
        await AdicionarManualAsync(admin, ativo, Segunda, Turno1012, "Ana");
        await AdicionarManualAsync(admin, inativo, Segunda, Turno0810, "Bia");
        await DefinirTurnosAsync(admin, ativo, (Segunda, Turno0810));
        await admin.PutAsJsonAsync($"/api/admin/carrinhos/{inativo}", new { nome = "Carrinho 02", descricao = (string?)null, ativo = false });

        var grade = await GradeAsync(admin);

        Assert.Equal(
            [
                (ativo, Segunda, Turno0810, true, 0),
                (ativo, Segunda, Turno1012, false, 1),
                (inativo, Segunda, Turno0810, false, 1),
            ],
            Celulas(grade));
    }

    [Fact]
    public async Task CadaPedido_TrazIdOrigemEContagemDeApoio()
    {
        var admin = await AdminAsync();
        var carrinhoId = await CriarCarrinhoAsync(admin);
        await DefinirTurnosAsync(admin, carrinhoId, (Segunda, Turno0810), (Terca, Turno0810));
        var publicador = Publicador();
        var id = (await JsonAsync(await SolicitarAsync(publicador, carrinhoId, Segunda, Turno0810, "Ana"))).GetProperty("id").GetInt32();
        await SolicitarAsync(publicador, carrinhoId, Terca, Turno0810, "Ana");
        await AdicionarManualAsync(admin, carrinhoId, Segunda, Turno0810, "Bia");

        var pedidos = PedidosDaGrade(await GradeAsync(admin));

        var ana = pedidos.First(p => p.GetProperty("solicitacaoId").GetInt32() == id);
        Assert.Equal("Ana", ana.GetProperty("publicadorNome").GetString());
        Assert.Equal(1, ana.GetProperty("origem").GetInt32());
        Assert.Equal(2, ana.GetProperty("totalNaEscala").GetInt32());
        var bia = pedidos.Single(p => p.GetProperty("publicadorNome").GetString() == "Bia");
        Assert.Equal(2, bia.GetProperty("origem").GetInt32());
        Assert.Equal(1, bia.GetProperty("totalNaEscala").GetInt32());
        Assert.All(pedidos, p => Assert.False(p.GetProperty("criancaOuIdoso").GetBoolean()));
    }
}
