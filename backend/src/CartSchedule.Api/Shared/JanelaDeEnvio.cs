using CartSchedule.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace CartSchedule.Api.Shared;

/// <summary>
/// Calcula em tempo real (sem job/cron) se a janela de envio do publicador está aberta
/// e para qual mês-alvo (PLANNING.md §4, TECHNICAL_SPEC.md §2.5).
/// A abertura é automática: todo dia 15 abre a escala do mês seguinte. O fechamento é só
/// manual — o administrador fecha (e pode reabrir) quando quiser (<see cref="Domain.Escala.EnvioFechado"/>).
/// Por isso a escala-alvo é a aberta mais recentemente: do dia 15 em diante, a do mês
/// seguinte; do dia 1 ao 14, a do mês corrente (aberta no dia 15 anterior). Só uma escala
/// fica em envio por vez: no dia 15 a anterior deixa de receber pedidos sozinha.
/// "Hoje" é a data no horário de Brasília, e não em UTC: servidores/containers rodam
/// em UTC, o que abriria a janela 3h antes (às 21h do dia 14).
/// </summary>
public static class JanelaDeEnvio
{
    /// <summary>
    /// Valor da extensão "codigo" do ProblemDetails quando um request é recusado por estar
    /// fora da janela — o frontend decide por ele, nunca pelo status HTTP ou pelo texto.
    /// </summary>
    public const string CodigoJanelaFechada = "JANELA_FECHADA";

    private const int DiaAbertura = 15;

    /// <summary>Mês da escala em envio: a aberta no último dia 15 (inclusive hoje).</summary>
    public static DateOnly MesAlvo(DateOnly hoje)
    {
        var primeiroDoMes = new DateOnly(hoje.Year, hoje.Month, 1);

        return hoje.Day >= DiaAbertura ? primeiroDoMes.AddMonths(1) : primeiroDoMes;
    }

    public static JanelaStatus Calcular(DateOnly hoje, bool envioFechado) =>
        new(!envioFechado, MesAlvo(hoje));

    /// <summary>
    /// O relógio vem por injeção (TimeProvider.System registrado em Program.cs) para os
    /// testes de integração poderem fixar a data. Escala ainda inexistente = envio aberto.
    /// </summary>
    public static async Task<JanelaStatus> CalcularParaHojeAsync(AppDbContext db, TimeProvider relogio, CancellationToken ct = default)
    {
        var mesAlvo = MesAlvo(Hoje(relogio));
        var envioFechado = await db.Escalas
            .AsNoTracking()
            .AnyAsync(e => e.MesReferencia == mesAlvo && e.EnvioFechado, ct);

        return new JanelaStatus(!envioFechado, mesAlvo);
    }

    /// <summary>Data de hoje no horário de Brasília.</summary>
    public static DateOnly Hoje(TimeProvider relogio) =>
        DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(relogio.GetUtcNow().UtcDateTime, FusoHorario));

    private static readonly TimeZoneInfo FusoHorario = ObterFusoHorario();

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
