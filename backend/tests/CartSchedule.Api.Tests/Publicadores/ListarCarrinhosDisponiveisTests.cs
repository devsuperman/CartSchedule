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
    public async Task TrazOcupacaoECheiaPorVagaDaEscalaAlvo()
    {
        var admin = await AdminAsync();
        var carrinho = await CriarCarrinhoAsync(admin);
        await DefinirTurnosAsync(admin, carrinho, (Segunda, Turno0810), (Segunda, Turno1012), (Terca, Turno1012));
        await SolicitarAsync(Publicador(), carrinho, Segunda, Turno0810, "Ana");
        await SolicitarAsync(Publicador(), carrinho, Segunda, Turno0810, "Bia");
        await SolicitarAsync(Publicador(), carrinho, Segunda, Turno1012, "Ana");
        // Excesso adicionado pelo admin em outra vaga conta na ocupação.
        await AdicionarManualAsync(admin, carrinho, Terca, Turno1012, "Caio");

        var carrinhos = await Fixture.Factory.CreateClient().GetFromJsonAsync<JsonElement>("/api/carrinhos");

        var vagas = carrinhos[0].GetProperty("disponibilidades").EnumerateArray()
            .Select(d => (d.GetProperty("ocupacao").GetInt32(), d.GetProperty("cheia").GetBoolean()))
            .ToArray();
        Assert.Equal([(2, true), (1, false), (1, false)], vagas);
    }

    [Fact]
    public async Task OcupacaoIgnoraOutrasEscalas()
    {
        var admin = await AdminAsync();
        var carrinho = await CriarCarrinhoAsync(admin);
        await DefinirTurnosAsync(admin, carrinho, (Segunda, Turno0810));
        await AdicionarManualAsync(admin, carrinho, Segunda, Turno0810, "Ana", mes: "2026-07");

        var carrinhos = await Fixture.Factory.CreateClient().GetFromJsonAsync<JsonElement>("/api/carrinhos");

        var vaga = carrinhos[0].GetProperty("disponibilidades")[0];
        Assert.Equal(0, vaga.GetProperty("ocupacao").GetInt32());
        Assert.False(vaga.GetProperty("cheia").GetBoolean());
    }
}
