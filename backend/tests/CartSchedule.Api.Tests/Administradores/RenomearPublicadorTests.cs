using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using CartSchedule.Api.Tests.Infraestrutura;

namespace CartSchedule.Api.Tests.Administradores;

public class RenomearPublicadorTests(ApiFixture fixture) : ApiTestBase(fixture)
{
    private async Task<(HttpClient Admin, Guid PublicadorId)> PublicadorComPedidoAsync(string nome = "Joao")
    {
        var admin = await AdminAsync();
        var carrinhoId = await CriarCarrinhoAsync(admin);
        await DefinirTurnosAsync(admin, carrinhoId, (Segunda, Turno0810), (Terca, Turno0810));
        var token = Guid.NewGuid();
        await SolicitarAsync(Publicador(token), carrinhoId, Segunda, Turno0810, nome);
        await SolicitarAsync(Publicador(token), carrinhoId, Terca, Turno0810, nome);
        return (admin, token);
    }

    private static Task<HttpResponseMessage> RenomearAsync(HttpClient client, Guid id, string nome) =>
        client.PutAsJsonAsync($"/api/admin/publicadores/{id}", new { nome });

    [Fact]
    public async Task Renomeia_EmTodosOsPedidosDaGrade()
    {
        var (admin, id) = await PublicadorComPedidoAsync();

        var resposta = await RenomearAsync(admin, id, " João Silva ");

        Assert.Equal(HttpStatusCode.NoContent, resposta.StatusCode);
        Assert.All(
            PedidosDaGrade(await GradeAsync(admin)),
            p => Assert.Equal("João Silva", p.GetProperty("publicadorNome").GetString()));
    }

    [Fact]
    public async Task NomeIgualAoDeOutroPublicador_EhPermitido()
    {
        var (admin, id) = await PublicadorComPedidoAsync();
        var carrinhoId = await CriarCarrinhoAsync(admin, "Carrinho 02");
        await DefinirTurnosAsync(admin, carrinhoId, (Segunda, Turno0810));
        await SolicitarAsync(Publicador(), carrinhoId, Segunda, Turno0810, "Maria");

        Assert.Equal(HttpStatusCode.NoContent, (await RenomearAsync(admin, id, "Maria")).StatusCode);
    }

    [Fact]
    public async Task MarcaEDesmarcaCriancaOuIdoso_EmTodosOsPedidos()
    {
        var (admin, id) = await PublicadorComPedidoAsync();

        var marcar = await admin.PutAsJsonAsync($"/api/admin/publicadores/{id}", new { nome = "Joao", criancaOuIdoso = true });

        Assert.Equal(HttpStatusCode.NoContent, marcar.StatusCode);
        Assert.All(PedidosDaGrade(await GradeAsync(admin)), p => Assert.True(p.GetProperty("criancaOuIdoso").GetBoolean()));

        await admin.PutAsJsonAsync($"/api/admin/publicadores/{id}", new { nome = "Joao", criancaOuIdoso = false });

        Assert.All(PedidosDaGrade(await GradeAsync(admin)), p => Assert.False(p.GetProperty("criancaOuIdoso").GetBoolean()));
    }

    [Fact]
    public async Task SoONome_MantemAMarca()
    {
        var (admin, id) = await PublicadorComPedidoAsync();
        await admin.PutAsJsonAsync($"/api/admin/publicadores/{id}", new { nome = "Joao", criancaOuIdoso = true });

        Assert.Equal(HttpStatusCode.NoContent, (await RenomearAsync(admin, id, "João")).StatusCode);

        Assert.All(PedidosDaGrade(await GradeAsync(admin)), p =>
        {
            Assert.Equal("João", p.GetProperty("publicadorNome").GetString());
            Assert.True(p.GetProperty("criancaOuIdoso").GetBoolean());
        });
    }

    [Fact]
    public async Task Inexistente_Retorna404()
    {
        var admin = await AdminAsync();

        Assert.Equal(HttpStatusCode.NotFound, (await RenomearAsync(admin, Guid.NewGuid(), "Ana")).StatusCode);
    }

    [Fact]
    public async Task NomeVazio_Retorna400()
    {
        var (admin, id) = await PublicadorComPedidoAsync();

        Assert.Equal(HttpStatusCode.BadRequest, (await RenomearAsync(admin, id, "  ")).StatusCode);
    }

    [Fact]
    public async Task SemLogin_Retorna401()
    {
        var (_, id) = await PublicadorComPedidoAsync();

        var resposta = await RenomearAsync(Fixture.Factory.CreateClient(), id, "Ana");

        Assert.Equal(HttpStatusCode.Unauthorized, resposta.StatusCode);
    }
}
