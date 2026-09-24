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
}
