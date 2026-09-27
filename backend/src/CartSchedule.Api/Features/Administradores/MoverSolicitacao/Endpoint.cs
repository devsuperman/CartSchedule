using CartSchedule.Api.Infrastructure;
using CartSchedule.Api.Shared;
using Microsoft.EntityFrameworkCore;

namespace CartSchedule.Api.Features.Administradores.MoverSolicitacao;

/// <summary>
/// PATCH /api/admin/solicitacoes/{id} — o administrador move uma solicitação para outra vaga
/// (carrinho, dia da semana, turno) da mesma escala, depois de combinar com o publicador.
/// Atualiza o registro no lugar: mantém Id, publicador, escala, origem e data do pedido.
/// O destino precisa estar configurado para o carrinho naquele dia; o limite de 2 por vaga
/// nunca bloqueia (é só sinalização) e o único bloqueio é a duplicidade (PLANNING.md regras
/// 3/4). Não é limitado pela janela de envio (regra 7).
/// </summary>
public static class Endpoint
{
    public static IEndpointRouteBuilder MapMoverSolicitacao(this IEndpointRouteBuilder app)
    {
        app.MapPatch("/api/admin/solicitacoes/{id:int}", HandleAsync)
            .AddEndpointFilter<ValidationFilter<Request>>()
            .RequireAuthorization();

        return app;
    }

    private static async Task<IResult> HandleAsync(int id, Request request, AppDbContext db, CancellationToken ct)
    {
        var solicitacao = await db.Solicitacoes.FirstOrDefaultAsync(s => s.Id == id, ct);
        if (solicitacao is null)
        {
            return Results.NotFound();
        }

        if (solicitacao.CarrinhoId == request.CarrinhoId
            && solicitacao.DiaSemana == request.DiaSemana
            && solicitacao.TurnoId == request.TurnoId)
        {
            return Results.NoContent();
        }

        var destinoExiste = await db.CarrinhoTurnos.AnyAsync(
            ct2 => ct2.CarrinhoId == request.CarrinhoId
                && ct2.DiaSemana == request.DiaSemana
                && ct2.TurnoId == request.TurnoId,
            ct);

        if (!destinoExiste)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["turnoId"] = ["O turno informado não está disponível para esse carrinho nesse dia da semana."],
            });
        }

        var jaExiste = await db.Solicitacoes.AnyAsync(
            s => s.PublicadorId == solicitacao.PublicadorId
                && s.EscalaId == solicitacao.EscalaId
                && s.CarrinhoId == request.CarrinhoId
                && s.DiaSemana == request.DiaSemana
                && s.TurnoId == request.TurnoId,
            ct);

        if (jaExiste)
        {
            return Results.Conflict(new
            {
                title = "Solicitação duplicada.",
                detail = "Este publicador já possui uma solicitação para essa combinação de carrinho, dia da semana e turno nessa escala.",
            });
        }

        solicitacao.CarrinhoId = request.CarrinhoId;
        solicitacao.DiaSemana = request.DiaSemana;
        solicitacao.TurnoId = request.TurnoId;

        await db.SaveChangesAsync(ct);

        return Results.NoContent();
    }
}
