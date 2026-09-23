using CartSchedule.Api.Domain.Enums;
using CartSchedule.Api.Infrastructure;
using CartSchedule.Api.Shared;
using Microsoft.EntityFrameworkCore;

namespace CartSchedule.Api.Features.Publicadores.ExcluirSolicitacao;

/// <summary>
/// DELETE /api/solicitacoes/{id} — regra 8 (PLANNING.md): o publicador só pode
/// excluir uma solicitação sua (Pendente ou Aprovada) enquanto a janela de envio está
/// aberta e apenas se ela for da escala do mês-alvo. Fora disso, só o administrador mexe
/// na solicitação (aprovando/rejeitando). Identificação via header X-Publicador-Token
/// (GUID = Publicador.Id). A exclusão apaga o registro (não há mudança de status), o que
/// também libera o publicador a solicitar de novo a mesma trinca.
/// </summary>
public static class Endpoint
{
    public static IEndpointRouteBuilder MapExcluirSolicitacao(this IEndpointRouteBuilder app)
    {
        app.MapDelete("/api/solicitacoes/{id:int}", async (int id, HttpContext ctx, AppDbContext db) =>
        {
            if (!ctx.Request.Headers.TryGetValue("X-Publicador-Token", out var tokenHeader) ||
                !Guid.TryParse(tokenHeader, out var publicadorId))
            {
                return Results.Problem(
                    detail: "Header X-Publicador-Token ausente ou inválido.",
                    statusCode: StatusCodes.Status400BadRequest);
            }

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

            if (solicitacao.Status is not (StatusSolicitacao.Pendente or StatusSolicitacao.Aprovada))
            {
                return Results.Problem(
                    detail: "Só é possível excluir solicitações Pendentes ou Aprovadas.",
                    statusCode: StatusCodes.Status409Conflict);
            }

            var janela = JanelaDeEnvio.CalcularParaHoje();
            if (!janela.Aberta)
            {
                return Results.Problem(
                    title: "Janela de envio fechada",
                    detail: "Solicitações só podem ser excluídas entre os dias 15 e 25 do mês. Fora desse período, fale com o administrador.",
                    statusCode: StatusCodes.Status400BadRequest,
                    extensions: new Dictionary<string, object?> { ["codigo"] = JanelaDeEnvio.CodigoJanelaFechada });
            }

            if (solicitacao.Escala.MesReferencia != janela.MesAlvo)
            {
                return Results.Problem(
                    title: "Solicitação fora da escala em aberto",
                    detail: "Só é possível excluir solicitações da escala do próximo mês. Para as demais, fale com o administrador.",
                    statusCode: StatusCodes.Status400BadRequest);
            }

            db.Solicitacoes.Remove(solicitacao);

            await db.SaveChangesAsync();

            return Results.NoContent();
        });

        return app;
    }
}
