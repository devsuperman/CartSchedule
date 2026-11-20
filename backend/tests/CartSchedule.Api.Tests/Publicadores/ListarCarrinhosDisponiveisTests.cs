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

        var carrinhos = await (await PublicadorAsync("Leitor")).GetFromJsonAsync<JsonElement>("/api/carrinhos");

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
        await SolicitarAsync(await PublicadorAsync("Ana"), carrinho, Segunda, Turno0810);
        await SolicitarAsync(await PublicadorAsync("Bia"), carrinho, Segunda, Turno0810);
        await SolicitarAsync(await PublicadorAsync("Ana"), carrinho, Segunda, Turno1012);
        // Excesso adicionado pelo admin em outra vaga conta na ocupação.
        await AdicionarRegistroAntigoPorNomeAsync(admin, carrinho, Terca, Turno1012, "Caio");

        var carrinhos = await (await PublicadorAsync("Leitor")).GetFromJsonAsync<JsonElement>("/api/carrinhos");

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
        await AdicionarRegistroAntigoPorNomeAsync(admin, carrinho, Segunda, Turno0810, "Ana", mes: "2026-07");

        var carrinhos = await (await PublicadorAsync("Leitor")).GetFromJsonAsync<JsonElement>("/api/carrinhos");

        var vaga = carrinhos[0].GetProperty("disponibilidades")[0];
        Assert.Equal(0, vaga.GetProperty("ocupacao").GetInt32());
        Assert.False(vaga.GetProperty("cheia").GetBoolean());
        Assert.Empty(Nomes(vaga));
    }

    private static async Task<JsonElement> PrimeiraVagaAsync(HttpClient cliente)
    {
        var carrinhos = await cliente.GetFromJsonAsync<JsonElement>("/api/carrinhos");
        return carrinhos[0].GetProperty("disponibilidades")[0];
    }

    private static string?[] Nomes(JsonElement vaga) =>
        vaga.GetProperty("nomes").EnumerateArray().Select(n => n.GetString()).ToArray();

    [Fact]
    public async Task TrazPrimeiroNomeDeQuemEstaNaVaga()
    {
        var admin = await AdminAsync();
        var carrinho = await CriarCarrinhoAsync(admin);
        await DefinirTurnosAsync(admin, carrinho, (Segunda, Turno0810));
        await SolicitarAsync(await PublicadorAsync("  Maria   da Silva "), carrinho, Segunda, Turno0810);

        var vaga = await PrimeiraVagaAsync(await PublicadorAsync("Leitor"));

        Assert.Equal(1, vaga.GetProperty("ocupacao").GetInt32());
        Assert.Equal(["Maria"], Nomes(vaga));
    }

    [Fact]
    public async Task VagaVazia_TrazNomesVazio()
    {
        var admin = await AdminAsync();
        var carrinho = await CriarCarrinhoAsync(admin);
        await DefinirTurnosAsync(admin, carrinho, (Segunda, Turno0810));

        Assert.Empty(Nomes(await PrimeiraVagaAsync(await PublicadorAsync("Leitor"))));
    }

    [Fact]
    public async Task VagaCheia_NaoExpoeNomes()
    {
        var admin = await AdminAsync();
        var carrinho = await CriarCarrinhoAsync(admin);
        await DefinirTurnosAsync(admin, carrinho, (Segunda, Turno0810));
        await SolicitarAsync(await PublicadorAsync("Ana"), carrinho, Segunda, Turno0810);
        await SolicitarAsync(await PublicadorAsync("Bia"), carrinho, Segunda, Turno0810);

        var vaga = await PrimeiraVagaAsync(await PublicadorAsync("Leitor"));

        Assert.True(vaga.GetProperty("cheia").GetBoolean());
        Assert.Empty(Nomes(vaga));
    }

    [Fact]
    public async Task NaoExpoeIdNemCriancaOuIdoso()
    {
        var admin = await AdminAsync();
        var carrinho = await CriarCarrinhoAsync(admin);
        await DefinirTurnosAsync(admin, carrinho, (Segunda, Turno0810));
        var joao = await PublicadorAsync("Joao Pereira");
        await SolicitarAsync(joao, carrinho, Segunda, Turno0810);
        var token = await IdDoPublicadorAsync(joao);
        (await admin.PutAsJsonAsync($"/api/admin/publicadores/{token}", new { nome = "Joao Pereira", criancaOuIdoso = true }))
            .EnsureSuccessStatusCode();

        var json = await (await PublicadorAsync("Leitor")).GetStringAsync("/api/carrinhos");

        Assert.DoesNotContain(token.ToString(), json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("Pereira", json);
        Assert.DoesNotContain("criancaOuIdoso", json, StringComparison.OrdinalIgnoreCase);
        var vaga = (await PrimeiraVagaAsync(await PublicadorAsync("Leitor"))).EnumerateObject().Select(p => p.Name);
        Assert.Equal(["diaSemana", "turnoId", "ocupacao", "cheia", "nomes"], vaga);
    }

    [Fact]
    public async Task NomeRefleteAEdicaoDoAdmin()
    {
        var admin = await AdminAsync();
        var carrinho = await CriarCarrinhoAsync(admin);
        await DefinirTurnosAsync(admin, carrinho, (Segunda, Turno0810));
        var mari = await PublicadorAsync("Mari");
        await SolicitarAsync(mari, carrinho, Segunda, Turno0810);
        var token = await IdDoPublicadorAsync(mari);
        (await admin.PutAsJsonAsync($"/api/admin/publicadores/{token}", new { nome = "Mariana Souza" })).EnsureSuccessStatusCode();

        Assert.Equal(["Mariana"], Nomes(await PrimeiraVagaAsync(await PublicadorAsync("Leitor"))));
    }
}
