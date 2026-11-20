using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using CartSchedule.Api.Tests.Infraestrutura;

namespace CartSchedule.Api.Tests.Publicadores;

/// <summary>
/// O publicador troca o próprio PIN (issue #50): informa o atual e o novo; o novo precisa ter
/// 4 dígitos e não ser óbvio. Os outros aparelhos dele são desconectados e o aparelho atual
/// continua logado com o token devolvido.
/// </summary>
public class TrocarPinTests(ApiFixture fixture) : ApiTestBase(fixture)
{
    private const string Rota = "/api/eu/pin";

    private async Task<(HttpClient Cliente, string Pin)> ContaLogadaAsync(string usuario = "maria", bool administrador = false)
    {
        var (_, pin) = await CriarContaAsync(await AdminAsync(), "Maria Souza", usuario, administrador: administrador);
        return (await LogadoAsync(usuario, pin), pin);
    }

    private async Task<HttpClient> LogadoAsync(string usuario, string pin)
    {
        var login = await LoginAsync(Fixture.Factory.CreateClient(), usuario, pin);
        login.EnsureSuccessStatusCode();
        return ClienteComToken(await JsonAsync(login));
    }

    private static Task<HttpResponseMessage> TrocarAsync(HttpClient cliente, string pinAtual, string pinNovo) =>
        cliente.PutAsJsonAsync(Rota, new { pinAtual, pinNovo });

    private static async Task<string?> CodigoAsync(HttpResponseMessage resposta) =>
        (await resposta.Content.ReadFromJsonAsync<JsonElement>()).TryGetProperty("codigo", out var codigo)
            ? codigo.GetString()
            : null;

    [Fact]
    public async Task Trocar_DevolveTokenNovo_ENovoPinEntra_EAntigoNao()
    {
        var (cliente, pinAntigo) = await ContaLogadaAsync();

        var resposta = await TrocarAsync(cliente, pinAntigo, "2580");

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);
        var corpo = await JsonAsync(resposta);
        Assert.False(string.IsNullOrEmpty(corpo.GetProperty("token").GetString()));
        Assert.Equal("publicador", corpo.GetProperty("papel").GetString());
        Assert.Equal(HttpStatusCode.OK, (await LoginAsync(Fixture.Factory.CreateClient(), "maria", "2580")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await LoginAsync(Fixture.Factory.CreateClient(), "maria", pinAntigo)).StatusCode);
    }

    [Fact]
    public async Task Trocar_DesconectaOsOutrosAparelhos_EOTokenNovoContinuaValendo()
    {
        var (aparelhoAtual, pin) = await ContaLogadaAsync();
        var outroAparelho = await LogadoAsync("maria", pin);

        var resposta = await TrocarAsync(aparelhoAtual, pin, "2580");

        Assert.Equal(HttpStatusCode.Unauthorized, (await outroAparelho.GetAsync("/api/eu")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await aparelhoAtual.GetAsync("/api/eu")).StatusCode);
        var comTokenNovo = ClienteComToken(await JsonAsync(resposta));
        Assert.Equal(HttpStatusCode.OK, (await comTokenNovo.GetAsync("/api/eu")).StatusCode);
    }

    [Fact]
    public async Task Administrador_TrocaOProprioPin_ETokenNovoEDeAdministrador()
    {
        var (cliente, pin) = await ContaLogadaAsync(administrador: true);

        var resposta = await TrocarAsync(cliente, pin, "2580");

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);
        var corpo = await JsonAsync(resposta);
        Assert.Equal("administrador", corpo.GetProperty("papel").GetString());
        Assert.Equal(HttpStatusCode.OK, (await ClienteComToken(corpo).GetAsync("/api/admin/publicadores")).StatusCode);
    }

    [Fact]
    public async Task PinAtualErrado_Retorna400_ENaoTroca_NemDesconecta()
    {
        var (cliente, pin) = await ContaLogadaAsync();
        var errado = pin == "9137" ? "9138" : "9137";

        var resposta = await TrocarAsync(cliente, errado, "2580");

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
        Assert.Equal("PIN_ATUAL_INVALIDO", await CodigoAsync(resposta));
        Assert.Equal(HttpStatusCode.OK, (await cliente.GetAsync("/api/eu")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await LoginAsync(Fixture.Factory.CreateClient(), "maria", pin)).StatusCode);
    }

    [Theory]
    [InlineData("0000")]
    [InlineData("7777")]
    [InlineData("1234")]
    [InlineData("4321")]
    [InlineData("6789")]
    [InlineData("9876")]
    public async Task PinNovoObvio_Retorna400PinFraco(string pinNovo)
    {
        var (cliente, pin) = await ContaLogadaAsync();

        var resposta = await TrocarAsync(cliente, pin, pinNovo);

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
        Assert.Equal("PIN_FRACO", await CodigoAsync(resposta));
        Assert.Equal(HttpStatusCode.OK, (await LoginAsync(Fixture.Factory.CreateClient(), "maria", pin)).StatusCode);
    }

    [Theory]
    [InlineData("")]
    [InlineData("123")]
    [InlineData("12345")]
    [InlineData("12a4")]
    [InlineData(" 2580")]
    [InlineData("２５８０")]
    public async Task PinNovoForaDoFormato_Retorna400(string pinNovo)
    {
        var (cliente, pin) = await ContaLogadaAsync();

        var resposta = await TrocarAsync(cliente, pin, pinNovo);

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await LoginAsync(Fixture.Factory.CreateClient(), "maria", pin)).StatusCode);
    }

    [Fact]
    public async Task SemToken_Retorna401()
    {
        var resposta = await TrocarAsync(Fixture.Factory.CreateClient(), "2580", "1357");

        Assert.Equal(HttpStatusCode.Unauthorized, resposta.StatusCode);
    }

    [Fact]
    public async Task AdministradorDeRecuperacao_NaoTemPin_Recebe403()
    {
        var resposta = await TrocarAsync(await AdminAsync(), ApiFixture.AdminSenha, "2580");

        Assert.Equal(HttpStatusCode.Forbidden, resposta.StatusCode);
    }
}
