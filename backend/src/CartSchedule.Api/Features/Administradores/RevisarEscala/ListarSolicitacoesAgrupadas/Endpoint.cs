using System.Globalization;
using CartSchedule.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace CartSchedule.Api.Features.Administradores.RevisarEscala.ListarSolicitacoesAgrupadas;

/// <summary>
/// GET /api/admin/escalas/{mes}/solicitacoes — agrupa as Solicitacoes de uma
/// Escala por (carrinho, dia da semana, turno) para a tela de revisão do
/// administrador (PLANNING.md regras 1-4, 13, 16; TASKS.md F2-BE-04).
///
/// Endpoint só de leitura: nunca cria a Escala caso ela ainda não exista para o mês —
/// apenas retorna `grupos: []` (o administrador pode navegar por qualquer mês, mesmo sem
/// nenhum envio ainda — PLANNING.md regra 7).
/// </summary>
public static class Endpoint
{
    public static IEndpointRouteBuilder MapListarSolicitacoesAgrupadas(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/admin/escalas/{mes}/solicitacoes", HandleAsync)
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
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.MesReferencia == mesReferencia, ct);

        if (escala is null)
        {
            return Results.Ok(new ListarSolicitacoesAgrupadasResponse(mes, []));
        }

        // Toda solicitação existente já conta na escala; o admin tira alguém excluindo o
        // registro (PLANNING.md regra 12a).
        var solicitacoes = await db.Solicitacoes
            .AsNoTracking()
            .Include(s => s.Publicador)
            .Include(s => s.Carrinho)
            .Where(s => s.EscalaId == escala.Id)
            .ToListAsync(ct);

        // Contagem de apoio ao desempate (regra 13/16): total do publicador na escala
        // inteira, em todas as trincas — puramente informativo, nunca usado para bloquear.
        var totalPorPublicador = solicitacoes
            .GroupBy(s => s.PublicadorId)
            .ToDictionary(g => g.Key, g => g.Count());

        var grupos = solicitacoes
            .GroupBy(s => (s.CarrinhoId, s.DiaSemana, s.TurnoId))
            .OrderBy(g => g.Key.CarrinhoId)
            .ThenBy(g => g.Key.DiaSemana)
            .ThenBy(g => g.Key.TurnoId)
            .Select(g => new GrupoResponse(
                g.Key.CarrinhoId,
                g.First().Carrinho.Nome,
                (int)g.Key.DiaSemana,
                g.Key.TurnoId,
                g.Count() > 2, // sinalização pura (regra 1/3) — nunca bloqueia nada
                g.OrderBy(s => s.CriadoEm)
                    .Select(s => new SolicitacaoAgrupadaResponse(
                        s.Id,
                        s.PublicadorId,
                        s.Publicador.Nome,
                        (int)s.Origem,
                        s.CriadoEm,
                        totalPorPublicador[s.PublicadorId]))
                    .ToList()))
            .ToList();

        return Results.Ok(new ListarSolicitacoesAgrupadasResponse(mes, grupos));
    }

    private static bool TryParseMes(string mes, out DateOnly mesReferencia)
    {
        mesReferencia = default;

        var partes = mes.Split('-');
        if (partes.Length != 2)
        {
            return false;
        }

        if (partes[0].Length != 4 || !int.TryParse(partes[0], NumberStyles.None, CultureInfo.InvariantCulture, out var ano))
        {
            return false;
        }

        if (partes[1].Length != 2 || !int.TryParse(partes[1], NumberStyles.None, CultureInfo.InvariantCulture, out var mesNumero))
        {
            return false;
        }

        if (mesNumero is < 1 or > 12)
        {
            return false;
        }

        mesReferencia = new DateOnly(ano, mesNumero, 1);
        return true;
    }
}
