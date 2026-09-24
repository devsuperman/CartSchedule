using CartSchedule.Api.Domain.Enums;
using CartSchedule.Api.Infrastructure;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace CartSchedule.Api.Features.Administradores.RevisarEscala.RejeitarSolicitacao;

/// <summary>
/// Rejeita uma Solicitacao Pendente ou Aprovada (o admin pode rever a decisão a qualquer
/// momento). Nunca verifica/bloqueia o limite de 2 por trinca
/// (carrinho, dia, turno) — essa regra é só sinalização visual em outro slice
/// (ListarSolicitacoesAgrupadas), nunca um bloqueio (PLANNING.md, regra 1/3).
/// Admin não é limitado pela janela de envio (regra 7): funciona em qualquer escala.
/// </summary>
public static class Endpoint
{
    public static IEndpointRouteBuilder MapRejeitarSolicitacao(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/admin/solicitacoes/{id:int}/rejeitar", RejeitarAsync)
            .RequireAuthorization();

        return app;
    }

    private static async Task<Results<Ok<SolicitacaoDecisaoResponse>, NotFound, ProblemHttpResult>> RejeitarAsync(
        int id, AppDbContext db)
    {
        var solicitacao = await db.Solicitacoes.FirstOrDefaultAsync(s => s.Id == id);

        if (solicitacao is null)
        {
            return TypedResults.NotFound();
        }

        if (solicitacao.Status is not (StatusSolicitacao.Pendente or StatusSolicitacao.Aprovada))
        {
            return TypedResults.Problem(
                detail: $"Solicitação #{id} não pode ser rejeitada (status atual: {solicitacao.Status}).",
                statusCode: StatusCodes.Status409Conflict);
        }

        solicitacao.Status = StatusSolicitacao.Rejeitada;
        solicitacao.DecididoEm = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync();

        return TypedResults.Ok(new SolicitacaoDecisaoResponse(solicitacao.Id, solicitacao.Status));
    }
}
