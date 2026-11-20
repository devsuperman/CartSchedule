using System.Security.Claims;
using CartSchedule.Api.Infrastructure;
using CartSchedule.Api.Infrastructure.Auth;
using CartSchedule.Api.Infrastructure.RateLimiting;
using CartSchedule.Api.Shared;
using Microsoft.EntityFrameworkCore;

namespace CartSchedule.Api.Features.Publicadores.ExcluirSolicitacao;

/// <summary>
/// DELETE /api/solicitacoes/{id} — regra 8 (PLANNING.md): o publicador só pode
/// excluir uma solicitação sua enquanto a janela de envio está aberta e apenas se ela for
/// da escala do mês-alvo. Fora disso, só o administrador a exclui. O publicador vem do token de login. A exclusão apaga o registro, o que
/// também libera o publicador a solicitar de novo a mesma trinca.
/// </summary>
public static class Endpoint
{
    public static IEndpointRouteBuilder MapExcluirSolicitacao(this IEndpointRouteBuilder app)
    {
        app.MapDelete("/api/solicitacoes/{id:int}", async (int id, ClaimsPrincipal usuarioLogado, AppDbContext db, TimeProvider relogio) =>
        {
            var publicadorId = usuarioLogado.PublicadorId();

            var solicitacao = await db.Solicitacoes
                .Include(s => s.Escala)
                .FirstOrDefaultAsync(s => s.Id == id);

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

            var janela = await JanelaDeEnvio.CalcularParaHojeAsync(db, relogio);
            if (!janela.Aberta)
            {
                return Results.Problem(
                    title: "Janela de envio fechada",
                    detail: "Solicitações só podem ser excluídas enquanto o envio estiver aberto. Fale com o administrador.",
                    statusCode: StatusCodes.Status400BadRequest,
                    extensions: new Dictionary<string, object?> { ["codigo"] = JanelaDeEnvio.CodigoJanelaFechada });
            }

            if (solicitacao.Escala.MesReferencia != janela.MesAlvo)
            {
                return Results.Problem(
                    title: "Solicitação fora da escala em aberto",
                    detail: "Só é possível excluir solicitações da escala em envio. Para as demais, fale com o administrador.",
                    statusCode: StatusCodes.Status400BadRequest);
            }

            db.Solicitacoes.Remove(solicitacao);

            await db.SaveChangesAsync();

            return Results.NoContent();
        })
        .RequireAuthorization(Politicas.Publicador)
        .RequireRateLimiting(RateLimitingExtensions.PoliticaEscritaPublicador);

        return app;
    }
}
