using CartSchedule.Api.Domain;
using CartSchedule.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace CartSchedule.Api.Features.Administradores.UnirPublicadores;

/// <summary>
/// "Unir B em A" na tela "Publicadores" (ADR 0001, issue #47): acaba com registros duplicados
/// da mesma pessoa. GET mostra a prévia; POST executa numa transação: move os pedidos da
/// origem (B) para o destino (A), descarta os que o destino já tem na mesma
/// <c>(escala, carrinho, dia, turno)</c> (duplicidade), passa a marca criança/idoso ao destino
/// se a origem a tinha (nunca desmarca) e apaga a origem. Nome, usuário e PIN do destino ficam
/// como estão. Não é limitado pela janela nem pela lotação (só sinalização na Escala).
/// </summary>
public static class Endpoint
{
    public static IEndpointRouteBuilder MapUnirPublicadores(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/admin/publicadores/{origemId:guid}/unir/{destinoId:guid}")
            .RequireAuthorization();

        group.MapGet("/", PreviaAsync);
        group.MapPost("/", UnirAsync);

        return app;
    }

    private static async Task<IResult> PreviaAsync(Guid origemId, Guid destinoId, AppDbContext db, CancellationToken ct)
    {
        if (origemId == destinoId)
        {
            return MesmoPublicador();
        }

        var existem = await db.Publicadores.CountAsync(p => p.Id == origemId || p.Id == destinoId, ct);
        if (existem < 2)
        {
            return Results.NotFound();
        }

        var (movidos, descartados) = await SepararPedidosAsync(db, origemId, destinoId, ct);
        return Results.Ok(new UnirPublicadoresResponse(movidos.Count, descartados.Count));
    }

    private static async Task<IResult> UnirAsync(Guid origemId, Guid destinoId, AppDbContext db, CancellationToken ct)
    {
        if (origemId == destinoId)
        {
            return MesmoPublicador();
        }

        await using var transacao = await db.Database.BeginTransactionAsync(ct);

        // FOR UPDATE nos dois registros: um pedido novo de qualquer um deles (a chave estrangeira
        // trava a linha do publicador) espera a união terminar, então a separação abaixo não
        // fica desatualizada nem esbarra no índice único da duplicidade.
        var publicadores = await db.Publicadores
            .FromSql($"SELECT * FROM publicadores WHERE \"Id\" IN ({origemId}, {destinoId}) ORDER BY \"Id\" FOR UPDATE")
            .ToListAsync(ct);

        var origem = publicadores.SingleOrDefault(p => p.Id == origemId);
        var destino = publicadores.SingleOrDefault(p => p.Id == destinoId);
        if (origem is null || destino is null)
        {
            return Results.NotFound();
        }

        var (movidos, descartados) = await SepararPedidosAsync(db, origemId, destinoId, ct);

        db.Solicitacoes.RemoveRange(descartados);
        foreach (var pedido in movidos)
        {
            pedido.Publicador = destino;
        }

        destino.CriancaOuIdoso |= origem.CriancaOuIdoso;
        db.Publicadores.Remove(origem);

        await db.SaveChangesAsync(ct);
        await transacao.CommitAsync(ct);

        return Results.Ok(new UnirPublicadoresResponse(movidos.Count, descartados.Count));
    }

    /// <summary>Pedidos da origem: os que vão ao destino e os que colidem com a duplicidade.</summary>
    private static async Task<(List<Solicitacao> Movidos, List<Solicitacao> Descartados)> SepararPedidosAsync(
        AppDbContext db, Guid origemId, Guid destinoId, CancellationToken ct)
    {
        var daOrigem = await db.Solicitacoes.Where(s => s.PublicadorId == origemId).ToListAsync(ct);
        var vagasDoDestino = (await db.Solicitacoes
                .Where(s => s.PublicadorId == destinoId)
                .Select(s => new { s.EscalaId, s.CarrinhoId, s.DiaSemana, s.TurnoId })
                .ToListAsync(ct))
            .ToHashSet();

        var descartados = daOrigem
            .Where(s => vagasDoDestino.Contains(new { s.EscalaId, s.CarrinhoId, s.DiaSemana, s.TurnoId }))
            .ToList();
        return (daOrigem.Except(descartados).ToList(), descartados);
    }

    private static IResult MesmoPublicador() =>
        Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["destinoId"] = ["Escolha outro publicador: não dá para unir um registro com ele mesmo."],
        });
}
