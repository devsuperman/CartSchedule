using CartSchedule.Api.Domain.Enums;
using CartSchedule.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace CartSchedule.Api.Features.Publicadores.CancelarSolicitacao;

/// <summary>
/// POST /api/solicitacoes/{id}/cancelar — regras 8/12 (PLANNING.md): o publicador pode
/// cancelar qualquer solicitação sua (Pendente ou Aprovada), a qualquer momento, sem
/// restrição de prazo. Identificação via header X-Publicador-Token (GUID = Publicador.Id).
/// </summary>
public static class Endpoint
{
    public static IEndpointRouteBuilder MapCancelarSolicitacao(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/solicitacoes/{id:int}/cancelar", async (int id, HttpContext ctx, AppDbContext db) =>
        {
            if (!ctx.Request.Headers.TryGetValue("X-Publicador-Token", out var tokenHeader) ||
                !Guid.TryParse(tokenHeader, out var publicadorId))
            {
                return Results.Problem(
                    detail: "Header X-Publicador-Token ausente ou inválido.",
                    statusCode: StatusCodes.Status400BadRequest);
            }

            var solicitacao = await db.Solicitacoes.FirstOrDefaultAsync(s => s.Id == id);

            if (solicitacao is null)
            {
                return Results.NotFound();
            }

            if (solicitacao.PublicadorId != publicadorId)
            {
                return Results.Problem(
                    detail: "Esta solicitação não pertence ao publicador informado.",
                    statusCode: StatusCodes.Status403Forbidden);
            }

            if (solicitacao.Status is not (StatusSolicitacao.Pendente or StatusSolicitacao.Aprovada))
            {
                return Results.Problem(
                    detail: "Só é possível cancelar solicitações Pendentes ou Aprovadas.",
                    statusCode: StatusCodes.Status409Conflict);
            }

            solicitacao.Status = StatusSolicitacao.Cancelada;
            solicitacao.DecididoEm = DateTimeOffset.UtcNow;

            await db.SaveChangesAsync();

            return Results.NoContent();
        });

        return app;
    }
}
