using CartSchedule.Api.Domain.Enums;
using CartSchedule.Api.Infrastructure;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace CartSchedule.Api.Features.Administradores.RevisarEscala.AprovarSolicitacao;

/// <summary>
/// Aprova uma Solicitacao Pendente ou Rejeitada (o admin pode rever a decisão a qualquer
/// momento). Nunca verifica/bloqueia o limite de 2 por trinca
/// (carrinho, dia, turno) — essa regra é só sinalização visual em outro slice
/// (ListarSolicitacoesAgrupadas), nunca um bloqueio (PLANNING.md, regra 1/3).
/// Admin não é limitado pela janela de envio (regra 7): funciona em qualquer escala.
/// </summary>
public static class Endpoint
{
    public static IEndpointRouteBuilder MapAprovarSolicitacao(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/admin/solicitacoes/{id:int}/aprovar", AprovarAsync)
            .RequireAuthorization();

        return app;
    }

    private static async Task<Results<Ok<SolicitacaoDecisaoResponse>, NotFound, ProblemHttpResult>> AprovarAsync(
        int id, AppDbContext db)
    {
        var solicitacao = await db.Solicitacoes.FirstOrDefaultAsync(s => s.Id == id);

        if (solicitacao is null)
        {
            return TypedResults.NotFound();
        }

        if (solicitacao.Status is not (StatusSolicitacao.Pendente or StatusSolicitacao.Rejeitada))
        {
            return TypedResults.Problem(
                detail: $"Solicitação #{id} não pode ser aprovada (status atual: {solicitacao.Status}).",
                statusCode: StatusCodes.Status409Conflict);
        }

        solicitacao.Status = StatusSolicitacao.Aprovada;
        solicitacao.DecididoEm = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync();

        return TypedResults.Ok(new SolicitacaoDecisaoResponse(solicitacao.Id, solicitacao.Status));
    }
}
