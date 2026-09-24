using System.Globalization;
using CartSchedule.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace CartSchedule.Api.Features.Administradores.ObterEscalaFinal;

/// <summary>
/// GET /api/admin/escalas/{mes}/grade — grade final do mês (Carrinho × Dia × Turno),
/// montada sob demanda a partir de todas as Solicitacao da escala (TASKS.md F2-BE-07).
/// </summary>
public static class Endpoint
{
    public static IEndpointRouteBuilder MapObterEscalaFinal(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/admin/escalas/{mes}/grade", HandleAsync)
            .RequireAuthorization();

        return app;
    }

    private static async Task<IResult> HandleAsync(string mes, AppDbContext db, CancellationToken ct)
    {
        if (!TryParseMes(mes, out var mesReferencia))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["mes"] = ["Formato inválido. Use yyyy-MM (ex: 2026-10)."],
            });
        }

        var escala = await db.Escalas
            .FirstOrDefaultAsync(e => e.MesReferencia == mesReferencia, ct);

        if (escala is null)
        {
            return Results.Ok(new EscalaFinalResponse(mes, []));
        }

        var solicitacoes = await db.Solicitacoes
            .Where(s => s.EscalaId == escala.Id)
            .Include(s => s.Carrinho)
            .Include(s => s.Publicador)
            .OrderBy(s => s.CarrinhoId)
            .ThenBy(s => s.DiaSemana)
            .ThenBy(s => s.TurnoId)
            .ToListAsync(ct);

        var celulas = solicitacoes
            .GroupBy(s => (s.CarrinhoId, s.DiaSemana, s.TurnoId))
            .Select(grupo => new EscalaFinalCelulaResponse(
                grupo.Key.CarrinhoId,
                grupo.First().Carrinho.Nome,
                grupo.Key.DiaSemana,
                grupo.Key.TurnoId,
                grupo
                    .Select(s => new PublicadorNaEscalaResponse(s.PublicadorId, s.Publicador.Nome))
                    .ToList()))
            .ToList();

        return Results.Ok(new EscalaFinalResponse(mes, celulas));
    }

    private static bool TryParseMes(string mes, out DateOnly mesReferencia)
    {
        var parseOk = DateOnly.TryParseExact(
            mes,
            "yyyy-MM",
            CultureInfo.InvariantCulture,
            DateTimeStyles.None,
            out mesReferencia);

        if (!parseOk)
        {
            return false;
        }

        mesReferencia = new DateOnly(mesReferencia.Year, mesReferencia.Month, 1);
        return true;
    }
}
