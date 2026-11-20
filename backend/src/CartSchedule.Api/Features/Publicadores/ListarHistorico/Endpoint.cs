using System.Security.Claims;
using CartSchedule.Api.Infrastructure;
using CartSchedule.Api.Infrastructure.Auth;
using Microsoft.EntityFrameworkCore;

namespace CartSchedule.Api.Features.Publicadores.ListarHistorico;

/// <summary>
/// GET /api/solicitacoes — histórico do próprio publicador (o do token de login), sempre disponível independentemente da janela
/// de envio (PLANNING.md regra 11 / CLAUDE.md regra 6).
/// </summary>
public static class Endpoint
{
    public static IEndpointRouteBuilder MapListarHistorico(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/solicitacoes", async (ClaimsPrincipal usuarioLogado, AppDbContext db) =>
        {
            var publicadorId = usuarioLogado.PublicadorId();

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
                    s.Carrinho.Descricao,
                    s.Carrinho.DataEspecial,
                    (int)s.DiaSemana,
                    s.TurnoId,
                    (int)s.Origem))
                .ToListAsync();

            return Results.Ok(historico);
        })
        .RequireAuthorization(Politicas.Publicador);

        return app;
    }
}
