using CartSchedule.Api.Infrastructure;
using CartSchedule.Api.Shared;
using Microsoft.EntityFrameworkCore;

namespace CartSchedule.Api.Features.Publicadores.ListarCarrinhosDisponiveis;

/// <summary>
/// GET /api/carrinhos — lista os carrinhos ativos (nome, descrição) e as disponibilidades
/// (dia da semana × turno) que cada um tem habilitadas, com a ocupação atual de cada vaga na
/// escala-alvo. Carrinhos de data especial (PLANNING.md regra 10a) só aparecem quando a data
/// cai no mês da escala-alvo. Rota pública, sem autenticação (TASKS.md F1-BE-02).
/// </summary>
public static class Endpoint
{
    public static IEndpointRouteBuilder MapListarCarrinhosDisponiveis(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/carrinhos", async (AppDbContext db, TimeProvider relogio, CancellationToken ct) =>
        {
            var mesAlvo = JanelaDeEnvio.MesAlvo(JanelaDeEnvio.Hoje(relogio));
            var mesSeguinte = mesAlvo.AddMonths(1);

            var ocupacoes = await db.Solicitacoes
                .AsNoTracking()
                .Where(s => s.Escala.MesReferencia == mesAlvo)
                .GroupBy(s => new { s.CarrinhoId, s.DiaSemana, s.TurnoId })
                .Select(g => new { g.Key.CarrinhoId, g.Key.DiaSemana, g.Key.TurnoId, Total = g.Count() })
                .ToListAsync(ct);
            var totais = ocupacoes.ToDictionary(o => (o.CarrinhoId, o.DiaSemana, o.TurnoId), o => o.Total);

            var carrinhos = await db.Carrinhos
                .AsNoTracking()
                .Where(c => c.Ativo)
                .Where(c => c.DataEspecial == null || (c.DataEspecial >= mesAlvo && c.DataEspecial < mesSeguinte))
                .OrderBy(c => c.Id)
                .Select(c => new
                {
                    c.Id,
                    c.Nome,
                    c.Descricao,
                    c.DataEspecial,
                    Turnos = c.CarrinhoTurnos
                        .OrderBy(ct => ct.DiaSemana)
                        .ThenBy(ct => ct.TurnoId)
                        .Select(ct => new { ct.DiaSemana, ct.TurnoId })
                        .ToList(),
                })
                .ToListAsync(ct);

            var resposta = carrinhos.Select(c => new CarrinhoDisponivelResponse(
                c.Id,
                c.Nome,
                c.Descricao,
                c.DataEspecial,
                c.Turnos.Select(t =>
                {
                    var ocupacao = totais.GetValueOrDefault((c.Id, t.DiaSemana, t.TurnoId));
                    return new DisponibilidadeResponse(
                        t.DiaSemana, t.TurnoId, ocupacao, ocupacao >= LotacaoDaVaga.LimiteParaPublicador);
                }).ToList()));

            return Results.Ok(resposta);
        });

        return app;
    }
}
