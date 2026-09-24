using CartSchedule.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace CartSchedule.Api.Features.Publicadores.ListarHistorico;

/// <summary>
/// GET /api/solicitacoes — histórico do próprio publicador (identificado via
/// header X-Publicador-Token), sempre disponível independentemente da janela
/// de envio (PLANNING.md regra 11 / CLAUDE.md regra 6).
/// </summary>
public static class Endpoint
{
    public static IEndpointRouteBuilder MapListarHistorico(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/solicitacoes", async (HttpContext ctx, AppDbContext db) =>
        {
            var tokenHeader = ctx.Request.Headers["X-Publicador-Token"].ToString();

            if (!Guid.TryParse(tokenHeader, out var publicadorId))
            {
                return Results.Problem(
                    detail: "Header X-Publicador-Token ausente ou inválido.",
                    statusCode: StatusCodes.Status400BadRequest);
            }

            var historico = await db.Solicitacoes
                .Where(s => s.PublicadorId == publicadorId)
                .Include(s => s.Carrinho)
                .Include(s => s.Escala)
                .OrderByDescending(s => s.CriadoEm)
                .Select(s => new ListarHistoricoResponse(
                    s.Id,
                    s.Escala.MesReferencia,
                    s.CarrinhoId,
                    s.Carrinho.Nome,
                    (int)s.DiaSemana,
                    s.TurnoId,
                    (int)s.Status,
                    (int)s.Origem))
                .ToListAsync();

            return Results.Ok(historico);
        });

        return app;
    }
}
