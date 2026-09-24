using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using CartSchedule.Api.Tests.Infraestrutura;

namespace CartSchedule.Api.Tests.Publicadores;

public class ListarHistoricoTests(ApiFixture fixture) : ApiTestBase(fixture)
{
    [Fact]
    public async Task CarrinhoComDescricao_HistoricoDevolveNomeEDescricao()
    {
        var admin = await AdminAsync();
        var criacao = await admin.PostAsJsonAsync("/api/admin/carrinhos", new { nome = "Carrinho 01", descricao = "Em frente à estação" });
        criacao.EnsureSuccessStatusCode();
        var carrinhoId = (await JsonAsync(criacao)).GetProperty("id").GetInt32();
        await DefinirTurnosAsync(admin, carrinhoId, (Segunda, Turno0810));
        var publicador = Publicador();
        (await SolicitarAsync(publicador, carrinhoId, Segunda, Turno0810)).EnsureSuccessStatusCode();

        var resposta = await publicador.GetAsync("/api/solicitacoes");

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);
        var item = Assert.Single((await JsonAsync(resposta)).EnumerateArray());
        Assert.Equal("Carrinho 01", item.GetProperty("carrinhoNome").GetString());
        Assert.Equal("Em frente à estação", item.GetProperty("carrinhoDescricao").GetString());
    }

    [Fact]
    public async Task CarrinhoSemDescricao_CarrinhoDescricaoVemNull()
    {
        var admin = await AdminAsync();
        var carrinhoId = await CriarCarrinhoAsync(admin);
        await DefinirTurnosAsync(admin, carrinhoId, (Segunda, Turno0810));
        var publicador = Publicador();
        (await SolicitarAsync(publicador, carrinhoId, Segunda, Turno0810)).EnsureSuccessStatusCode();

        var resposta = await publicador.GetAsync("/api/solicitacoes");

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);
        var item = Assert.Single((await JsonAsync(resposta)).EnumerateArray());
        Assert.Equal("Carrinho 01", item.GetProperty("carrinhoNome").GetString());
        Assert.Equal(JsonValueKind.Null, item.GetProperty("carrinhoDescricao").ValueKind);
    }
}
