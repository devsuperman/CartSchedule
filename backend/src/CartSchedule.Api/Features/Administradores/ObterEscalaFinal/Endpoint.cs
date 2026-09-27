using System.Globalization;
using CartSchedule.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace CartSchedule.Api.Features.Administradores.ObterEscalaFinal;

/// <summary>
/// GET /api/admin/escalas/{mes}/grade — grade do mês (Carrinho × Dia × Turno), montada sob
/// demanda a partir das vagas configuradas e de todas as Solicitacao da escala (TASKS.md
/// F2-BE-07, F13-BE-02). É a base da tela de gestão da escala do administrador.
/// </summary>
public static class Endpoint
{
    public static IEndpointRouteBuilder MapObterEscalaFinal(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/admin/escalas/{mes}/grade", HandleAsync)
            .RequireAuthorization();

        return app;
    }

    private static async Task<IResult> HandleAsync(string mes, AppDbContext db, CancellationToken ct)
    {
        if (!TryParseMes(mes, out var mesReferencia))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["mes"] = ["Formato inválido. Use yyyy-MM (ex: 2026-10)."],
            });
        }

        // Vagas configuradas dos carrinhos ativos: aparecem mesmo vazias, para o admin ver
        // onde ainda cabe gente.
        var vagas = await db.CarrinhoTurnos
            .AsNoTracking()
            .Where(ct2 => ct2.Carrinho.Ativo)
            .Select(ct2 => new { ct2.CarrinhoId, CarrinhoNome = ct2.Carrinho.Nome, ct2.DiaSemana, ct2.TurnoId })
            .ToListAsync(ct);

        // Só leitura: nunca cria a Escala; sem escala, as vagas vêm vazias.
        var escala = await db.Escalas
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.MesReferencia == mesReferencia, ct);

        var solicitacoes = escala is null
            ? []
            : await db.Solicitacoes
                .AsNoTracking()
                .Where(s => s.EscalaId == escala.Id)
                .Include(s => s.Carrinho)
                .Include(s => s.Publicador)
                .OrderBy(s => s.CriadoEm)
                .ThenBy(s => s.Id)
                .ToListAsync(ct);

        var totalPorPublicador = solicitacoes
            .GroupBy(s => s.PublicadorId)
            .ToDictionary(g => g.Key, g => g.Count());

        var pedidosPorCelula = solicitacoes.ToLookup(s => (s.CarrinhoId, s.DiaSemana, s.TurnoId));
        var disponiveis = vagas.Select(v => (v.CarrinhoId, v.DiaSemana, v.TurnoId)).ToHashSet();

        var nomesDosCarrinhos = vagas
            .Select(v => (v.CarrinhoId, v.CarrinhoNome))
            .Concat(solicitacoes.Select(s => (s.CarrinhoId, CarrinhoNome: s.Carrinho.Nome)))
            .DistinctBy(c => c.CarrinhoId)
            .ToDictionary(c => c.CarrinhoId, c => c.CarrinhoNome);

        var celulas = disponiveis
            .Union(pedidosPorCelula.Select(g => g.Key))
            .OrderBy(c => c.CarrinhoId)
            .ThenBy(c => c.DiaSemana)
            .ThenBy(c => c.TurnoId)
            .Select(c => new EscalaFinalCelulaResponse(
                c.CarrinhoId,
                nomesDosCarrinhos[c.CarrinhoId],
                c.DiaSemana,
                c.TurnoId,
                disponiveis.Contains(c),
                pedidosPorCelula[c]
                    .Select(s => new PublicadorNaEscalaResponse(
                        s.Id,
                        s.PublicadorId,
                        s.Publicador.Nome,
                        s.Origem,
                        totalPorPublicador[s.PublicadorId]))
                    .ToList()))
            .ToList();

        return Results.Ok(new EscalaFinalResponse(mes, celulas));
    }

    private static bool TryParseMes(string mes, out DateOnly mesReferencia)
    {
        var parseOk = DateOnly.TryParseExact(
            mes,
            "yyyy-MM",
            CultureInfo.InvariantCulture,
            DateTimeStyles.None,
            out mesReferencia);

        if (!parseOk)
        {
            return false;
        }

        mesReferencia = new DateOnly(mesReferencia.Year, mesReferencia.Month, 1);
        return true;
    }
}
