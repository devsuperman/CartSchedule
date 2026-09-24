using System.Net;
using System.Net.Http.Json;
using CartSchedule.Api.Tests.Infraestrutura;

namespace CartSchedule.Api.Tests.Administradores;

/// <summary>
/// PLANNING.md regras 17 e 20: o admin escolhe, por carrinho e por dia da semana, quais
/// dos 6 turnos fixos ficam disponíveis (PUT = substituição completa do conjunto).
/// </summary>
public class GerenciarTurnosDoCarrinhoTests(ApiFixture fixture) : ApiTestBase(fixture)
{
    [Fact]
    public async Task CarrinhoNovo_NasceSemDisponibilidades()
    {
        var admin = await AdminAsync();
        var carrinhoId = await CriarCarrinhoAsync(admin);

        var turnos = await JsonAsync(await admin.GetAsync($"/api/admin/carrinhos/{carrinhoId}/turnos"));

        Assert.Empty(Disponibilidades(turnos));
    }

    [Fact]
    public async Task Put_MesmoTurnoEmDiasDiferentes_GuardaCadaDiaSeparado()
    {
        var admin = await AdminAsync();
        var carrinhoId = await CriarCarrinhoAsync(admin);

        var resposta = await DefinirTurnosAsync(admin, carrinhoId,
            (Terca, Turno1012), (Segunda, Turno0810), (Segunda, Turno0810), (Segunda, Turno1012));

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);
        // Duplicata ignorada e resposta ordenada por dia e depois por turno.
        (int, int)[] esperado = [(Segunda, Turno0810), (Segunda, Turno1012), (Terca, Turno1012)];
        Assert.Equal(esperado, Disponibilidades(await JsonAsync(resposta)));
        Assert.Equal(esperado, Disponibilidades(await JsonAsync(await admin.GetAsync($"/api/admin/carrinhos/{carrinhoId}/turnos"))));
    }

    [Fact]
    public async Task Put_SubstituiOConjuntoInteiro()
    {
        var admin = await AdminAsync();
        var carrinhoId = await CriarCarrinhoAsync(admin);
        await DefinirTurnosAsync(admin, carrinhoId, (Segunda, Turno0810), (Terca, Turno1012));

        var resposta = await DefinirTurnosAsync(admin, carrinhoId, (Sexta, Turno0608));

        (int, int)[] esperado = [(Sexta, Turno0608)];
        Assert.Equal(esperado, Disponibilidades(await JsonAsync(resposta)));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(6)] // Sábado não existe no sistema (regra 1).
    [InlineData(7)]
    public async Task Put_DiaForaDeSegundaASexta_Retorna400(int dia)
    {
        var admin = await AdminAsync();
        var carrinhoId = await CriarCarrinhoAsync(admin);

        var resposta = await DefinirTurnosAsync(admin, carrinhoId, (dia, Turno0810));

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(7)]
    public async Task Put_TurnoForaDosSeisFixos_Retorna400(int turno)
    {
        var admin = await AdminAsync();
        var carrinhoId = await CriarCarrinhoAsync(admin);

        var resposta = await DefinirTurnosAsync(admin, carrinhoId, (Segunda, turno));

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
    }

    [Fact]
    public async Task Put_CarrinhoInexistente_Retorna404()
    {
        var admin = await AdminAsync();

        var resposta = await DefinirTurnosAsync(admin, 999, (Segunda, Turno0810));

        Assert.Equal(HttpStatusCode.NotFound, resposta.StatusCode);
    }

    [Fact]
    public async Task Put_SemLoginDeAdmin_Retorna401()
    {
        var admin = await AdminAsync();
        var carrinhoId = await CriarCarrinhoAsync(admin);

        var resposta = await DefinirTurnosAsync(Fixture.Factory.CreateClient(), carrinhoId, (Segunda, Turno0810));

        Assert.Equal(HttpStatusCode.Unauthorized, resposta.StatusCode);
    }

    [Fact]
    public async Task ListagemDoAdmin_TrazAsDisponibilidadesDeCadaCarrinho()
    {
        var admin = await AdminAsync();
        var carrinhoId = await CriarCarrinhoAsync(admin);
        await DefinirTurnosAsync(admin, carrinhoId, (Quarta, Turno1416));

        var carrinhos = await admin.GetFromJsonAsync<System.Text.Json.JsonElement>("/api/admin/carrinhos");

        (int, int)[] esperado = [(Quarta, Turno1416)];
        Assert.Equal(esperado, Disponibilidades(carrinhos[0]));
    }
}
