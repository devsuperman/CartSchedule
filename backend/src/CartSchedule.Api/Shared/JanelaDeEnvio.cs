namespace CartSchedule.Api.Shared;

/// <summary>
/// Calcula em tempo real (sem job/cron) se a janela de envio do publicador está aberta
/// e para qual mês-alvo, a partir da data atual do servidor (PLANNING.md §4,
/// TECHNICAL_SPEC.md §2.5). Aberta do dia 15 ao dia 25 (inclusive) do mês corrente;
/// a escala-alvo é sempre o mês seguinte ao mês corrente.
/// "Hoje" é a data no horário de Brasília, e não em UTC: servidores/containers rodam
/// em UTC, o que abriria e fecharia a janela 3h antes (às 21h dos dias 14 e 25).
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

    private static readonly TimeZoneInfo FusoHorario = ObterFusoHorario();

    public static JanelaStatus CalcularParaHoje() =>
        Calcular(DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, FusoHorario)));

    private static TimeZoneInfo ObterFusoHorario()
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById("America/Sao_Paulo");
        }
        catch (Exception ex) when (ex is TimeZoneNotFoundException or InvalidTimeZoneException)
        {
            // Imagem sem tzdata: Brasília não tem horário de verão desde 2019, então UTC-3 fixo.
            return TimeZoneInfo.CreateCustomTimeZone("America/Sao_Paulo", TimeSpan.FromHours(-3), "Brasília", "Brasília");
        }
    }
}

public record JanelaStatus(bool Aberta, DateOnly MesAlvo);
