using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using CartSchedule.Api.Tests.Infraestrutura;

namespace CartSchedule.Api.Tests.Administradores;

/// <summary>
/// PLANNING.md §4: o envio abre sozinho no dia 15 e só o administrador fecha (e reabre),
/// apenas para a escala em envio.
/// </summary>
public class AlterarEnvioEscalaTests(ApiFixture fixture) : ApiTestBase(fixture)
{
    private async Task<JsonElement> JanelaAsync() =>
        await Fixture.Factory.CreateClient().GetFromJsonAsync<JsonElement>("/api/janela");

    [Fact]
    public async Task SemFechar_JanelaAbertaParaOMesSeguinte()
    {
        var janela = await JanelaAsync();

        Assert.True(janela.GetProperty("aberta").GetBoolean());
        Assert.Equal("2026-10-01", janela.GetProperty("mesAlvo").GetString());
    }

    [Fact]
    public async Task Fechar_E_Reabrir_RefleteNaJanelaENaGrade()
    {
        var admin = await AdminAsync();

        var fechar = await AlterarEnvioAsync(admin, aberto: false);

        Assert.Equal(HttpStatusCode.NoContent, fechar.StatusCode);
        Assert.False((await JanelaAsync()).GetProperty("aberta").GetBoolean());
        Assert.False((await GradeAsync(admin)).GetProperty("envio").GetProperty("aberto").GetBoolean());

        var reabrir = await AlterarEnvioAsync(admin, aberto: true);

        Assert.Equal(HttpStatusCode.NoContent, reabrir.StatusCode);
        Assert.True((await JanelaAsync()).GetProperty("aberta").GetBoolean());
        Assert.True((await GradeAsync(admin)).GetProperty("envio").GetProperty("aberto").GetBoolean());
    }

    [Fact]
    public async Task FecharDuasVezes_EhIdempotente()
    {
        var admin = await AdminAsync();
        await AlterarEnvioAsync(admin, aberto: false);

        var resposta = await AlterarEnvioAsync(admin, aberto: false);

        Assert.Equal(HttpStatusCode.NoContent, resposta.StatusCode);
        Assert.False((await JanelaAsync()).GetProperty("aberta").GetBoolean());
    }

    [Theory]
    [InlineData("2026-09")]
    [InlineData("2026-11")]
    public async Task EscalaQueNaoEstaEmEnvio_Retorna400(string mes)
    {
        var resposta = await AlterarEnvioAsync(await AdminAsync(), aberto: false, mes);

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
        Assert.True((await JanelaAsync()).GetProperty("aberta").GetBoolean());
    }

    [Fact]
    public async Task AntesDoDia15_AEscalaEmEnvioEhADoMesCorrente()
    {
        Fixture.Relogio.Agora = new DateTimeOffset(2026, 10, 5, 15, 0, 0, TimeSpan.Zero);
        var admin = await AdminAsync();

        Assert.Equal(HttpStatusCode.BadRequest, (await AlterarEnvioAsync(admin, aberto: false, "2026-11")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await AlterarEnvioAsync(admin, aberto: false, "2026-10")).StatusCode);
        Assert.False((await JanelaAsync()).GetProperty("aberta").GetBoolean());
    }

    [Fact]
    public async Task GradeDeOutroMes_NaoTrazEnvio()
    {
        var grade = await GradeAsync(await AdminAsync(), "2026-09");

        Assert.Equal(JsonValueKind.Null, grade.GetProperty("envio").ValueKind);
    }

    [Fact]
    public async Task MesInvalido_Retorna400()
    {
        var resposta = await AlterarEnvioAsync(await AdminAsync(), aberto: false, "outubro");

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
    }

    [Fact]
    public async Task SemOCampoAberto_Retorna400ENaoFecha()
    {
        var resposta = await (await AdminAsync()).PutAsJsonAsync($"/api/admin/escalas/{MesAlvo}/envio", new { });

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
        Assert.True((await JanelaAsync()).GetProperty("aberta").GetBoolean());
    }

    [Fact]
    public async Task SemLogin_Retorna401()
    {
        var resposta = await AlterarEnvioAsync(Fixture.Factory.CreateClient(), aberto: false);

        Assert.Equal(HttpStatusCode.Unauthorized, resposta.StatusCode);
        Assert.True((await JanelaAsync()).GetProperty("aberta").GetBoolean());
    }
}
