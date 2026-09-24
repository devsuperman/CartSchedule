using CartSchedule.Api.Shared;
using CartSchedule.Api.Tests.Infraestrutura;

namespace CartSchedule.Api.Tests.Shared;

/// <summary>PLANNING.md regra 6: janela aberta do dia 15 ao 25 (inclusive), mês-alvo = mês seguinte.</summary>
public class JanelaDeEnvioTests
{
    [Theory]
    [InlineData(14, false)]
    [InlineData(15, true)]
    [InlineData(25, true)]
    [InlineData(26, false)]
    public void Calcular_AbreSoDoDia15Ao25(int dia, bool aberta)
    {
        var status = JanelaDeEnvio.Calcular(new DateOnly(2026, 9, dia));

        Assert.Equal(aberta, status.Aberta);
        Assert.Equal(new DateOnly(2026, 10, 1), status.MesAlvo);
    }

    [Fact]
    public void Calcular_EmDezembro_MesAlvoEhJaneiroDoAnoSeguinte()
    {
        Assert.Equal(new DateOnly(2027, 1, 1), JanelaDeEnvio.Calcular(new DateOnly(2026, 12, 20)).MesAlvo);
    }

    [Fact]
    public void CalcularParaHoje_UsaHorarioDeBrasilia_NaoUtc()
    {
        // 25/09 às 23:30 em Brasília já é 26/09 em UTC — a janela ainda deve estar aberta.
        var fimDoDia25 = new RelogioDeTeste(new DateTimeOffset(2026, 9, 26, 2, 30, 0, TimeSpan.Zero));
        Assert.True(JanelaDeEnvio.CalcularParaHoje(fimDoDia25).Aberta);

        // 14/09 às 22:00 em Brasília já é 15/09 em UTC — a janela ainda deve estar fechada.
        var noiteDoDia14 = new RelogioDeTeste(new DateTimeOffset(2026, 9, 15, 1, 0, 0, TimeSpan.Zero));
        Assert.False(JanelaDeEnvio.CalcularParaHoje(noiteDoDia14).Aberta);
    }
}
