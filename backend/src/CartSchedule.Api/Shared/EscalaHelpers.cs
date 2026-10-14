using CartSchedule.Api.Domain;
using CartSchedule.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace CartSchedule.Api.Shared;

/// <summary>
/// Resolve/cria a Escala (mês de referência) sob demanda — não há tela de cadastro de
/// escalas; a entidade nasce na primeira vez que é referenciada (PLANNING.md §9,
/// TECHNICAL_SPEC.md §2.5).
/// </summary>
public static class EscalaHelpers
{
    public static async Task<Escala> ObterOuCriarAsync(AppDbContext db, DateOnly mesReferencia, CancellationToken ct = default)
    {
        var primeiroDiaDoMes = new DateOnly(mesReferencia.Year, mesReferencia.Month, 1);

        var escala = await db.Escalas
            .FirstOrDefaultAsync(e => e.MesReferencia == primeiroDiaDoMes, ct);

        if (escala is not null)
        {
            return escala;
        }

        // ON CONFLICT: no dia 15 vários primeiros envios chegam juntos e todos tentam criar a
        // escala do mês; com Add + SaveChanges os perdedores estourariam o índice único (500).
        await db.Database.ExecuteSqlInterpolatedAsync(
            $"""INSERT INTO escalas ("MesReferencia", "EnvioFechado") VALUES ({primeiroDiaDoMes}, FALSE) ON CONFLICT ("MesReferencia") DO NOTHING""",
            ct);

        return await db.Escalas.FirstAsync(e => e.MesReferencia == primeiroDiaDoMes, ct);
    }
}
