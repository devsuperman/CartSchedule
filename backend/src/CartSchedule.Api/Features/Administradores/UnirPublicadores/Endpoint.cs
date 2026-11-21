using System.Security.Claims;
using CartSchedule.Api.Domain;
using CartSchedule.Api.Domain.Enums;
using CartSchedule.Api.Infrastructure;
using CartSchedule.Api.Shared;
using Microsoft.EntityFrameworkCore;

namespace CartSchedule.Api.Features.Administradores.UnirPublicadores;

/// <summary>
/// "Unir outros registros a este" na tela "Publicadores" (PLANNING.md regra 15a, issues #47 e #67):
/// acaba com registros duplicados da mesma pessoa. O administrador parte do registro que fica
/// (destino) e escolhe uma ou mais origens. A prévia só conta; unir executa numa transação: os
/// pedidos das origens passam ao destino, que fica com um só pedido por
/// <c>(escala, carrinho, dia, turno)</c> (duplicidade) — os demais são descartados —, a marca
/// criança/idoso passa ao destino se alguma origem a tinha (nunca desmarca) e as origens são
/// apagadas. Nome, usuário e senha do destino ficam como estão. Não é limitado pela janela nem
/// pela lotação (só sinalização na Escala). A própria conta do administrador não pode ser origem
/// (409 PROPRIA_CONTA): seria apagada; ela pode ser o destino.
/// </summary>
public static class Endpoint
{
    public static IEndpointRouteBuilder MapUnirPublicadores(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/admin/publicadores/{destinoId:guid}/unir")
            .RequireAuthorization();

        group.MapPost("/previa", PreviaAsync);
        group.MapPost("/", UnirAsync);

        return app;
    }

    private static async Task<IResult> PreviaAsync(
        Guid destinoId, UnirPublicadoresRequest request, ClaimsPrincipal usuarioLogado, AppDbContext db,
        CancellationToken ct)
    {
        if (Recusa(destinoId, request, usuarioLogado) is { } recusa)
        {
            return recusa;
        }

        var origemIds = request.OrigemIds!;
        var existem = await db.Publicadores.CountAsync(p => p.Id == destinoId || origemIds.Contains(p.Id), ct);
        if (existem < origemIds.Count + 1)
        {
            return Results.NotFound();
        }

        var (movidos, descartados) = await SepararPedidosAsync(db, origemIds, destinoId, ct);
        return Results.Ok(new UnirPublicadoresResponse(movidos.Count, descartados.Count));
    }

    private static async Task<IResult> UnirAsync(
        Guid destinoId, UnirPublicadoresRequest request, ClaimsPrincipal usuarioLogado, AppDbContext db,
        CancellationToken ct)
    {
        if (Recusa(destinoId, request, usuarioLogado) is { } recusa)
        {
            return recusa;
        }

        var origemIds = request.OrigemIds!;
        var todos = origemIds.Append(destinoId).ToArray();

        await using var transacao = await db.Database.BeginTransactionAsync(ct);

        // FOR UPDATE em todos os registros, em ordem de Id (sem deadlock entre uniões simultâneas):
        // um pedido novo de qualquer um deles (a chave estrangeira trava a linha do publicador)
        // espera a união terminar, então a separação abaixo não fica desatualizada nem esbarra
        // no índice único da duplicidade.
        var publicadores = await db.Publicadores
            .FromSql($"SELECT * FROM publicadores WHERE \"Id\" = ANY({todos}) ORDER BY \"Id\" FOR UPDATE")
            .ToListAsync(ct);

        var destino = publicadores.SingleOrDefault(p => p.Id == destinoId);
        if (destino is null || publicadores.Count < todos.Length)
        {
            return Results.NotFound();
        }

        var (movidos, descartados) = await SepararPedidosAsync(db, origemIds, destinoId, ct);

        db.Solicitacoes.RemoveRange(descartados);
        foreach (var pedido in movidos)
        {
            pedido.PublicadorId = destinoId;
        }

        destino.CriancaOuIdoso |= publicadores.Any(p => p.CriancaOuIdoso);
        await db.SaveChangesAsync(ct);

        // Apagadas direto no banco, depois de os pedidos já terem saído delas: não depende de o EF
        // ter desvinculado os pedidos rastreados antes de aplicar a exclusão em cascata.
        await db.Publicadores.Where(p => origemIds.Contains(p.Id)).ExecuteDeleteAsync(ct);
        await transacao.CommitAsync(ct);

        return Results.Ok(new UnirPublicadoresResponse(movidos.Count, descartados.Count));
    }

    /// <summary>
    /// Pedidos das origens: os que vão ao destino e os que colidem com a duplicidade — com um
    /// pedido do destino ou com um de outra origem que já vai ao destino na mesma vaga.
    /// </summary>
    private static async Task<(List<Solicitacao> Movidos, List<Solicitacao> Descartados)> SepararPedidosAsync(
        AppDbContext db, List<Guid> origemIds, Guid destinoId, CancellationToken ct)
    {
        var dasOrigens = await db.Solicitacoes
            .Where(s => origemIds.Contains(s.PublicadorId))
            .OrderBy(s => s.Id)
            .ToListAsync(ct);
        // Vagas que o destino terá: as dele e, uma a uma, as que cada pedido movido ocupa.
        var vagasDoDestino = (await db.Solicitacoes
                .AsNoTracking()
                .Where(s => s.PublicadorId == destinoId)
                .ToListAsync(ct))
            .Select(Vaga.De)
            .ToHashSet();

        var movidos = new List<Solicitacao>();
        var descartados = new List<Solicitacao>();
        foreach (var pedido in dasOrigens)
        {
            (vagasDoDestino.Add(Vaga.De(pedido)) ? movidos : descartados).Add(pedido);
        }

        return (movidos, descartados);
    }

    /// <summary>
    /// Lista vazia, ids repetidos ou o destino entre as origens (400); a própria conta do
    /// administrador logado entre as origens (409).
    /// </summary>
    private static IResult? Recusa(Guid destinoId, UnirPublicadoresRequest request, ClaimsPrincipal usuarioLogado)
    {
        var origemIds = request.OrigemIds;
        string? erro = origemIds switch
        {
            null or [] => "Escolha ao menos um registro para unir.",
            _ when origemIds.Contains(destinoId) =>
                "Escolha outros registros: não dá para unir um registro com ele mesmo.",
            _ when origemIds.Distinct().Count() < origemIds.Count => "O mesmo registro foi escolhido mais de uma vez.",
            _ => null,
        };
        if (erro is not null)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["origemIds"] = [erro] });
        }

        if (origemIds!.Any(id => PropriaConta.Eh(usuarioLogado, id)))
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
