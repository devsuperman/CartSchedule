using System.Net;
using CartSchedule.Api.Tests.Infraestrutura;

namespace CartSchedule.Api.Tests.Publicadores;

/// <summary>PLANNING.md regra 12 / CLAUDE.md regra 8.</summary>
public class ExcluirSolicitacaoTests(ApiFixture fixture) : ApiTestBase(fixture)
{
    private async Task<(HttpClient Publicador, int CarrinhoId, int SolicitacaoId)> SolicitacaoCriadaAsync()
    {
        var admin = await AdminAsync();
        var carrinhoId = await CriarCarrinhoAsync(admin);
        await DefinirTurnosAsync(admin, carrinhoId, (Segunda, Turno0810));
        var publicador = Publicador();
        var criada = await JsonAsync(await SolicitarAsync(publicador, carrinhoId, Segunda, Turno0810));
        return (publicador, carrinhoId, criada.GetProperty("id").GetInt32());
    }

    [Fact]
    public async Task DentroDaJanela_ApagaELiberaPedirDeNovo()
    {
        var (publicador, carrinhoId, solicitacaoId) = await SolicitacaoCriadaAsync();

        var exclusao = await publicador.DeleteAsync($"/api/solicitacoes/{solicitacaoId}");
        var novoPedido = await SolicitarAsync(publicador, carrinhoId, Segunda, Turno0810);

        Assert.Equal(HttpStatusCode.NoContent, exclusao.StatusCode);
        Assert.Equal(HttpStatusCode.Created, novoPedido.StatusCode);
    }

    [Fact]
    public async Task ForaDaJanela_Retorna400ComCodigoJanelaFechada()
    {
        var (publicador, _, solicitacaoId) = await SolicitacaoCriadaAsync();
        Fixture.Relogio.Agora = new DateTimeOffset(2026, 9, 27, 15, 0, 0, TimeSpan.Zero);

        var resposta = await publicador.DeleteAsync($"/api/solicitacoes/{solicitacaoId}");

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
        Assert.Equal("JANELA_FECHADA", (await JsonAsync(resposta)).GetProperty("codigo").GetString());
    }

    [Fact]
    public async Task SolicitacaoDeOutroPublicador_Retorna403()
    {
        var (_, _, solicitacaoId) = await SolicitacaoCriadaAsync();

        var resposta = await Publicador().DeleteAsync($"/api/solicitacoes/{solicitacaoId}");

        Assert.Equal(HttpStatusCode.Forbidden, resposta.StatusCode);
    }
}
