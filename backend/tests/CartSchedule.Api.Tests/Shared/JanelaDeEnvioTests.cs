using CartSchedule.Api.Shared;
using CartSchedule.Api.Tests.Infraestrutura;

namespace CartSchedule.Api.Tests.Shared;

/// <summary>
/// PLANNING.md §4: a escala do mês seguinte abre no dia 15 e só fecha pelo administrador;
/// até o dia 15 seguinte a escala em envio continua sendo a que abriu no dia 15 anterior.
/// </summary>
public class JanelaDeEnvioTests
{
    [Theory]
    [InlineData(1, 9)]
    [InlineData(14, 9)]
    [InlineData(15, 10)]
    [InlineData(27, 10)]
    [InlineData(28, 10)]
    [InlineData(30, 10)]
    public void MesAlvo_EhOAbertoNoUltimoDia15(int dia, int mesEsperado)
    {
        Assert.Equal(new DateOnly(2026, mesEsperado, 1), JanelaDeEnvio.MesAlvo(new DateOnly(2026, 9, dia)));
    }

    [Fact]
    public void MesAlvo_EmDezembro_EhJaneiroDoAnoSeguinte()
    {
        Assert.Equal(new DateOnly(2027, 1, 1), JanelaDeEnvio.MesAlvo(new DateOnly(2026, 12, 20)));
    }

    [Theory]
    [InlineData(false, true)]
    [InlineData(true, false)]
    public void Calcular_SoFechaPeloAdministrador(bool envioFechado, bool aberta)
    {
        var status = JanelaDeEnvio.Calcular(new DateOnly(2026, 9, 28), envioFechado);

        Assert.Equal(aberta, status.Aberta);
        Assert.Equal(new DateOnly(2026, 10, 1), status.MesAlvo);
    }

    [Fact]
    public void Hoje_UsaHorarioDeBrasilia_NaoUtc()
    {
        // 14/09 às 22:00 em Brasília já é 15/09 em UTC — a escala de Outubro ainda não abriu.
        var noiteDoDia14 = new RelogioDeTeste(new DateTimeOffset(2026, 9, 15, 1, 0, 0, TimeSpan.Zero));
        Assert.Equal(new DateOnly(2026, 9, 14), JanelaDeEnvio.Hoje(noiteDoDia14));
        Assert.Equal(new DateOnly(2026, 9, 1), JanelaDeEnvio.MesAlvo(JanelaDeEnvio.Hoje(noiteDoDia14)));
    }
}
