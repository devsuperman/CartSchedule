using CartSchedule.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace CartSchedule.Api.Features.Publicadores.ListarCarrinhosDisponiveis;

/// <summary>
/// GET /api/carrinhos — lista os carrinhos ativos (nome, descrição) e as disponibilidades
/// (dia da semana × turno) que cada um tem habilitadas. Rota pública, sem autenticação (TASKS.md F1-BE-02).
/// </summary>
public static class Endpoint
{
    public static IEndpointRouteBuilder MapListarCarrinhosDisponiveis(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/carrinhos", async (AppDbContext db) =>
        {
            var carrinhos = await db.Carrinhos
                .Where(c => c.Ativo)
                .OrderBy(c => c.Id)
                .Select(c => new CarrinhoDisponivelResponse(
                    c.Id,
                    c.Nome,
                    c.Descricao,
                    c.CarrinhoTurnos
                        .OrderBy(ct => ct.DiaSemana)
                        .ThenBy(ct => ct.TurnoId)
                        .Select(ct => new DisponibilidadeResponse(ct.DiaSemana, ct.TurnoId))
                        .ToList()))
                .ToListAsync();

            return Results.Ok(carrinhos);
        });

        return app;
    }
}
