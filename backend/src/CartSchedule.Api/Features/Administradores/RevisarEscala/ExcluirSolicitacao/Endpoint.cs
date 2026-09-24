using CartSchedule.Api.Infrastructure;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace CartSchedule.Api.Features.Administradores.RevisarEscala.ExcluirSolicitacao;

/// <summary>
/// DELETE /api/admin/solicitacoes/{id} — o administrador tira alguém da escala apagando a
/// Solicitacao de vez (PLANNING.md regra 12a): não há aprovação nem rejeição, toda
/// solicitação existente já conta. Não é limitado pela janela de envio (regra 7) e nunca
/// decide sozinho quem sai de um grupo excedente (regra 13).
/// </summary>
public static class Endpoint
{
    public static IEndpointRouteBuilder MapExcluirSolicitacaoAdmin(this IEndpointRouteBuilder app)
    {
        app.MapDelete("/api/admin/solicitacoes/{id:int}", ExcluirAsync)
            .RequireAuthorization();

        return app;
    }

    private static async Task<Results<NoContent, NotFound>> ExcluirAsync(int id, AppDbContext db)
    {
        var excluidas = await db.Solicitacoes.Where(s => s.Id == id).ExecuteDeleteAsync();

        return excluidas == 0 ? TypedResults.NotFound() : TypedResults.NoContent();
    }
}
