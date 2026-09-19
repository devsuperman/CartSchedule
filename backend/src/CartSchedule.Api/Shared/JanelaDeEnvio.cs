namespace CartSchedule.Api.Shared;

/// <summary>
/// Calcula em tempo real (sem job/cron) se a janela de envio do publicador está aberta
/// e para qual mês-alvo, a partir da data atual do servidor (PLANNING.md §4,
/// TECHNICAL_SPEC.md §2.5). Aberta do dia 15 ao dia 25 (inclusive) do mês corrente;
/// a escala-alvo é sempre o mês seguinte ao mês corrente.
/// </summary>
public static class JanelaDeEnvio
{
    private const int DiaAbertura = 15;
    private const int DiaFechamento = 25;

    public static JanelaStatus Calcular(DateOnly hoje)
    {
        var aberta = hoje.Day >= DiaAbertura && hoje.Day <= DiaFechamento;
        var mesAlvo = new DateOnly(hoje.Year, hoje.Month, 1).AddMonths(1);

        return new JanelaStatus(aberta, mesAlvo);
    }

    public static JanelaStatus CalcularParaHoje() => Calcular(DateOnly.FromDateTime(DateTime.UtcNow));
}

public record JanelaStatus(bool Aberta, DateOnly MesAlvo);
