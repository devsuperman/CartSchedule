using System.Net.Http.Json;
using System.Text.Json;
using CartSchedule.Api.Tests.Infraestrutura;

namespace CartSchedule.Api.Tests.Publicadores;

public class ListarCarrinhosDisponiveisTests(ApiFixture fixture) : ApiTestBase(fixture)
{
    [Fact]
    public async Task ListaSoCarrinhosAtivos_ComAsDisponibilidadesPorDia()
    {
        var admin = await AdminAsync();
        var ativo = await CriarCarrinhoAsync(admin, "Carrinho 01");
        var inativo = await CriarCarrinhoAsync(admin, "Carrinho 02");
        await DefinirTurnosAsync(admin, ativo, (Segunda, Turno0810), (Terca, Turno1012));
        await DefinirTurnosAsync(admin, inativo, (Segunda, Turno0810));
        await admin.PutAsJsonAsync($"/api/admin/carrinhos/{inativo}", new { nome = "Carrinho 02", descricao = (string?)null, ativo = false });

        var carrinhos = await Fixture.Factory.CreateClient().GetFromJsonAsync<JsonElement>("/api/carrinhos");

        var unico = Assert.Single(carrinhos.EnumerateArray());
        Assert.Equal(ativo, unico.GetProperty("id").GetInt32());
        (int, int)[] esperado = [(Segunda, Turno0810), (Terca, Turno1012)];
        Assert.Equal(esperado, Disponibilidades(unico));
    }

    [Fact]
    public async Task InformaOcupacaoDaEscalaAlvo_EMarcaVagaCheia()
    {
        var admin = await AdminAsync();
        var carrinho = await CriarCarrinhoAsync(admin);
        await DefinirTurnosAsync(admin, carrinho, (Segunda, Turno0810), (Terca, Turno1012));
        await SolicitarAsync(Publicador(), carrinho, Segunda, Turno0810, "Ana");
        await SolicitarAsync(Publicador(), carrinho, Segunda, Turno0810, "Bia");
        await SolicitarAsync(Publicador(), carrinho, Terca, Turno1012, "Ana");

        var carrinhos = await Fixture.Factory.CreateClient().GetFromJsonAsync<JsonElement>("/api/carrinhos");

        var vagas = Assert.Single(carrinhos.EnumerateArray()).GetProperty("disponibilidades").EnumerateArray().ToArray();
        Assert.Equal((2, true), (vagas[0].GetProperty("ocupacao").GetInt32(), vagas[0].GetProperty("cheia").GetBoolean()));
        Assert.Equal((1, false), (vagas[1].GetProperty("ocupacao").GetInt32(), vagas[1].GetProperty("cheia").GetBoolean()));
    }
}
