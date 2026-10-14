using CartSchedule.Api.Infrastructure;
using CartSchedule.Api.Shared;
using Microsoft.EntityFrameworkCore;

namespace CartSchedule.Api.Features.Publicadores.ListarCarrinhosDisponiveis;

/// <summary>
/// GET /api/carrinhos — lista os carrinhos ativos (nome, descrição) e as disponibilidades
/// (dia da semana × turno) que cada um tem habilitadas, com a ocupação atual da escala-alvo
/// (quantas pessoas já pediram a vaga e se ela está cheia). Rota pública, sem autenticação
/// (TASKS.md F1-BE-02).
/// </summary>
public static class Endpoint
{
    public static IEndpointRouteBuilder MapListarCarrinhosDisponiveis(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/carrinhos", async (AppDbContext db, TimeProvider relogio) =>
        {
            var mesAlvo = JanelaDeEnvio.MesAlvo(JanelaDeEnvio.Hoje(relogio));

            var ocupacoes = await db.Solicitacoes
                .Where(s => s.Escala.MesReferencia == mesAlvo)
                .GroupBy(s => new { s.CarrinhoId, s.DiaSemana, s.TurnoId })
                .Select(g => new { g.Key.CarrinhoId, g.Key.DiaSemana, g.Key.TurnoId, Total = g.Count() })
                .ToDictionaryAsync(o => (o.CarrinhoId, o.DiaSemana, o.TurnoId), o => o.Total);

            var carrinhos = await db.Carrinhos
                .Where(c => c.Ativo)
                .OrderBy(c => c.Id)
                .Select(c => new
                {
                    c.Id,
                    c.Nome,
                    c.Descricao,
                    Turnos = c.CarrinhoTurnos
                        .OrderBy(ct => ct.DiaSemana)
                        .ThenBy(ct => ct.TurnoId)
                        .Select(ct => new { ct.DiaSemana, ct.TurnoId })
                        .ToList(),
                })
                .ToListAsync();

            return Results.Ok(carrinhos.Select(c => new CarrinhoDisponivelResponse(
                c.Id,
                c.Nome,
                c.Descricao,
                c.Turnos.Select(t =>
                {
                    ocupacoes.TryGetValue((c.Id, t.DiaSemana, t.TurnoId), out var total);
                    return new DisponibilidadeResponse(t.DiaSemana, t.TurnoId, total, total >= LotacaoDaVaga.Limite);
                }).ToList())));
        });

        return app;
    }
}
