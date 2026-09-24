using CartSchedule.Api.Domain;
using CartSchedule.Api.Domain.Enums;
using CartSchedule.Api.Infrastructure;
using CartSchedule.Api.Shared;
using Microsoft.EntityFrameworkCore;

namespace CartSchedule.Api.Features.Administradores.GerenciarTurnosDoCarrinho;

/// <summary>
/// GET/PUT /api/admin/carrinhos/{id}/turnos — gerencia apenas a associação
/// (CarrinhoTurno) entre um carrinho, o dia da semana e o conjunto FIXO de 6 turnos
/// do sistema (PLANNING.md regras 17/20). Nunca cria, edita ou remove um `Turno` — só
/// linhas de `CarrinhoTurno`. Remover um turno daqui não afeta `Solicitacao`
/// já existentes (regra 18), o que é automático pois `Solicitacao` não
/// referencia `CarrinhoTurno`.
/// </summary>
public static class Endpoint
{
    /// <summary>Ids fixos e válidos dos 6 turnos seedados (Infrastructure/AppDbContext.cs).</summary>
    private static readonly HashSet<int> TurnoIdsValidos = [1, 2, 3, 4, 5, 6];

    public static IEndpointRouteBuilder MapGerenciarTurnosDoCarrinho(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/admin/carrinhos/{id:int}/turnos")
            .RequireAuthorization();

        group.MapGet("", ObterTurnosDoCarrinho);

        group.MapPut("", AtualizarTurnosDoCarrinho)
            .AddEndpointFilter<ValidationFilter<AtualizarTurnosDoCarrinhoRequest>>();

        return app;
    }

    private static async Task<IResult> ObterTurnosDoCarrinho(int id, AppDbContext db)
    {
        var carrinho = await db.Carrinhos
            .Include(c => c.CarrinhoTurnos)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (carrinho is null)
        {
            return Results.NotFound();
        }

        return Results.Ok(new TurnosDoCarrinhoResponse
        {
            CarrinhoId = carrinho.Id,
            Disponibilidades = Ordenar(carrinho.CarrinhoTurnos.Select(ct => (ct.DiaSemana, ct.TurnoId))),
        });
    }

    private static async Task<IResult> AtualizarTurnosDoCarrinho(int id, AtualizarTurnosDoCarrinhoRequest request, AppDbContext db)
    {
        var carrinho = await db.Carrinhos
            .Include(c => c.CarrinhoTurnos)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (carrinho is null)
        {
            return Results.NotFound();
        }

        var solicitadas = request.Disponibilidades
            .Select(d => (d.DiaSemana, d.TurnoId))
            .ToHashSet();

        var idsInvalidos = solicitadas
            .Select(d => d.TurnoId)
            .Where(turnoId => !TurnoIdsValidos.Contains(turnoId))
            .Distinct()
            .ToList();
        if (idsInvalidos.Count > 0)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["Disponibilidades"] = [$"Ids de turno inválidos: {string.Join(", ", idsInvalidos)}. Os únicos turnos válidos são os ids 1 a 6 (fixos do sistema)."],
            });
        }

        var atuais = carrinho.CarrinhoTurnos.Select(ct => (ct.DiaSemana, ct.TurnoId)).ToHashSet();

        var paraRemover = carrinho.CarrinhoTurnos
            .Where(ct => !solicitadas.Contains((ct.DiaSemana, ct.TurnoId)))
            .ToList();
        db.CarrinhoTurnos.RemoveRange(paraRemover);

        var paraAdicionar = solicitadas
            .Where(d => !atuais.Contains(d))
            .Select(d => new CarrinhoTurno { CarrinhoId = carrinho.Id, DiaSemana = d.DiaSemana, TurnoId = d.TurnoId });
        db.CarrinhoTurnos.AddRange(paraAdicionar);

        await db.SaveChangesAsync();

        return Results.Ok(new TurnosDoCarrinhoResponse
        {
            CarrinhoId = carrinho.Id,
            Disponibilidades = Ordenar(solicitadas),
        });
    }

    private static List<DisponibilidadeResponse> Ordenar(IEnumerable<(DiaSemana DiaSemana, int TurnoId)> disponibilidades) =>
        disponibilidades
            .OrderBy(d => d.DiaSemana)
            .ThenBy(d => d.TurnoId)
            .Select(d => new DisponibilidadeResponse(d.DiaSemana, d.TurnoId))
            .ToList();
}
