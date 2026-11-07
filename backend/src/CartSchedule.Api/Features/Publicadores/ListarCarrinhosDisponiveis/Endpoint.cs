using CartSchedule.Api.Infrastructure;
using CartSchedule.Api.Shared;
using Microsoft.EntityFrameworkCore;

namespace CartSchedule.Api.Features.Publicadores.ListarCarrinhosDisponiveis;

/// <summary>
/// GET /api/carrinhos — lista os carrinhos ativos (nome, descrição) e as disponibilidades
/// (dia da semana × turno) que cada um tem habilitadas, com a ocupação atual de cada vaga na
/// escala-alvo. Carrinhos de data especial (PLANNING.md regra 10a) só aparecem quando a data
/// cai no mês da escala-alvo. Rota pública, sem autenticação (TASKS.md F1-BE-02).
/// Cada vaga não cheia traz o primeiro nome de quem já está nela (issue #33 — ajuda o
/// publicador a formar a dupla); o nome completo, o id e a marca criança/idoso nunca saem
/// daqui, e a vaga cheia não expõe nomes (PLANNING.md seção 5, passo 5).
/// </summary>
public static class Endpoint
{
    public static IEndpointRouteBuilder MapListarCarrinhosDisponiveis(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/carrinhos", async (AppDbContext db, TimeProvider relogio, CancellationToken ct) =>
        {
            var mesAlvo = JanelaDeEnvio.MesAlvo(JanelaDeEnvio.Hoje(relogio));
            var mesSeguinte = mesAlvo.AddMonths(1);

            // Um registro por pedido (só os campos da vaga + nome): a ocupação é a contagem e os
            // nomes saem na ordem de chegada.
            var pedidos = await db.Solicitacoes
                .AsNoTracking()
                .Where(s => s.Escala.MesReferencia == mesAlvo)
                .OrderBy(s => s.Id)
                .Select(s => new { s.CarrinhoId, s.DiaSemana, s.TurnoId, s.Publicador.Nome })
                .ToListAsync(ct);
            var pessoasPorVaga = pedidos
                .GroupBy(p => (p.CarrinhoId, p.DiaSemana, p.TurnoId))
                .ToDictionary(g => g.Key, g => g.Select(p => p.Nome).ToList());

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
                    var pessoas = pessoasPorVaga.GetValueOrDefault((c.Id, t.DiaSemana, t.TurnoId)) ?? [];
                    var cheia = pessoas.Count >= LotacaoDaVaga.LimiteParaPublicador;
                    var nomes = cheia ? [] : pessoas.Select(PrimeiroNome).ToList();
                    return new DisponibilidadeResponse(t.DiaSemana, t.TurnoId, pessoas.Count, cheia, nomes);
                }).ToList()));

            return Results.Ok(resposta);
        });

        return app;
    }

    /// <summary>Só o primeiro nome, como no "Olá, Fulano" do cabeçalho do publicador.</summary>
    private static string PrimeiroNome(string nome) =>
        nome.Split((char[]?)null, 2, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .FirstOrDefault() ?? "";
}
