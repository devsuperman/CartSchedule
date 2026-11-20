using System.Security.Claims;
using CartSchedule.Api.Domain;
using CartSchedule.Api.Domain.Enums;
using CartSchedule.Api.Infrastructure;
using CartSchedule.Api.Shared;
using Microsoft.EntityFrameworkCore;

namespace CartSchedule.Api.Features.Administradores.UnirPublicadores;

/// <summary>
/// "Unir B em A" na tela "Publicadores" (ADR 0001, issue #47): acaba com registros duplicados
/// da mesma pessoa. GET mostra a prévia; POST executa numa transação: move os pedidos da
/// origem (B) para o destino (A), descarta os que o destino já tem na mesma
/// <c>(escala, carrinho, dia, turno)</c> (duplicidade), passa a marca criança/idoso ao destino
/// se a origem a tinha (nunca desmarca) e apaga a origem. Nome, usuário e PIN do destino ficam
/// como estão. Não é limitado pela janela nem pela lotação (só sinalização na Escala).
/// O administrador não une a própria conta a outra (409 PROPRIA_CONTA): ela seria apagada.
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

    private static async Task<IResult> PreviaAsync(
        Guid origemId, Guid destinoId, ClaimsPrincipal usuarioLogado, AppDbContext db, CancellationToken ct)
    {
        if (Recusa(origemId, destinoId, usuarioLogado) is { } recusa)
        {
            return recusa;
        }

        var existem = await db.Publicadores.CountAsync(p => p.Id == origemId || p.Id == destinoId, ct);
        if (existem < 2)
        {
            return Results.NotFound();
        }

        var (movidos, descartados) = await SepararPedidosAsync(db, origemId, destinoId, ct);
        return Results.Ok(new UnirPublicadoresResponse(movidos.Count, descartados.Count));
    }

    private static async Task<IResult> UnirAsync(
        Guid origemId, Guid destinoId, ClaimsPrincipal usuarioLogado, AppDbContext db, CancellationToken ct)
    {
        if (Recusa(origemId, destinoId, usuarioLogado) is { } recusa)
        {
            return recusa;
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
            pedido.PublicadorId = destinoId;
        }

        destino.CriancaOuIdoso |= origem.CriancaOuIdoso;
        await db.SaveChangesAsync(ct);

        // Apagada direto no banco, depois de os pedidos já terem saído dela: não depende de o EF
        // ter desvinculado os pedidos rastreados antes de aplicar a exclusão em cascata.
        await db.Publicadores.Where(p => p.Id == origemId).ExecuteDeleteAsync(ct);
        await transacao.CommitAsync(ct);

        return Results.Ok(new UnirPublicadoresResponse(movidos.Count, descartados.Count));
    }

    /// <summary>Pedidos da origem: os que vão ao destino e os que colidem com a duplicidade.</summary>
    private static async Task<(List<Solicitacao> Movidos, List<Solicitacao> Descartados)> SepararPedidosAsync(
        AppDbContext db, Guid origemId, Guid destinoId, CancellationToken ct)
    {
        var daOrigem = await db.Solicitacoes.Where(s => s.PublicadorId == origemId).ToListAsync(ct);
        var vagasDoDestino = (await db.Solicitacoes
                .AsNoTracking()
                .Where(s => s.PublicadorId == destinoId)
                .ToListAsync(ct))
            .Select(Vaga.De)
            .ToHashSet();

        var descartados = daOrigem.Where(s => vagasDoDestino.Contains(Vaga.De(s))).ToList();
        return (daOrigem.Except(descartados).ToList(), descartados);
    }

    /// <summary>Origem igual ao destino (400) ou a própria conta do administrador logado (409).</summary>
    private static IResult? Recusa(Guid origemId, Guid destinoId, ClaimsPrincipal usuarioLogado)
    {
        if (origemId == destinoId)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["destinoId"] = ["Escolha outro publicador: não dá para unir um registro com ele mesmo."],
            });
        }

        if (PropriaConta.Eh(usuarioLogado, origemId))
        {
            return PropriaConta.Problema(
                "Você não pode unir a sua própria conta a outra: ela seria apagada. Una a outra conta à sua.");
        }

        return null;
    }

    /// <summary>A chave da duplicidade (PLANNING.md regra 4): a mesma vaga na mesma escala.</summary>
    private readonly record struct Vaga(int EscalaId, int CarrinhoId, DiaSemana DiaSemana, int TurnoId)
    {
        public static Vaga De(Solicitacao s) => new(s.EscalaId, s.CarrinhoId, s.DiaSemana, s.TurnoId);
    }
}
