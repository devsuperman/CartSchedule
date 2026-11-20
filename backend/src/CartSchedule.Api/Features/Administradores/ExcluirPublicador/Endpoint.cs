using System.Security.Claims;
using CartSchedule.Api.Infrastructure;
using CartSchedule.Api.Shared;
using Microsoft.EntityFrameworkCore;

namespace CartSchedule.Api.Features.Administradores.ExcluirPublicador;

/// <summary>
/// "Excluir publicador" na tela "Publicadores" (ADR 0002, issue #61): apaga definitivamente a
/// conta e todos os pedidos dela, de todas as escalas (passadas inclusive). GET mostra a prévia
/// (quantos pedidos, em quantas escalas). Pode excluir outro administrador, mas não a própria
/// conta (409 PROPRIA_CONTA): o administrador ficaria sem acesso no meio da ação.
/// </summary>
public static class Endpoint
{
    public static IEndpointRouteBuilder MapExcluirPublicador(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/admin/publicadores/{id:guid}").RequireAuthorization();

        group.MapGet("/exclusao", PreviaAsync);
        group.MapDelete("/", ExcluirAsync);

        return app;
    }

    private static async Task<IResult> PreviaAsync(
        Guid id, ClaimsPrincipal usuarioLogado, AppDbContext db, CancellationToken ct)
    {
        if (RecusaPropriaConta(id, usuarioLogado) is { } recusa)
        {
            return recusa;
        }

        if (!await db.Publicadores.AnyAsync(p => p.Id == id, ct))
        {
            return Results.NotFound();
        }

        var pedidos = await db.Solicitacoes
            .Where(s => s.PublicadorId == id)
            .GroupBy(s => s.EscalaId)
            .Select(g => g.Count())
            .ToListAsync(ct);

        return Results.Ok(new ExcluirPublicadorPreviaResponse(pedidos.Sum(), pedidos.Count));
    }

    private static async Task<IResult> ExcluirAsync(
        Guid id, ClaimsPrincipal usuarioLogado, AppDbContext db, CancellationToken ct)
    {
        if (RecusaPropriaConta(id, usuarioLogado) is { } recusa)
        {
            return recusa;
        }

        await using var transacao = await db.Database.BeginTransactionAsync(ct);

        // Os pedidos saem explicitamente, sem depender da exclusão em cascata do banco.
        await db.Solicitacoes.Where(s => s.PublicadorId == id).ExecuteDeleteAsync(ct);
        if (await db.Publicadores.Where(p => p.Id == id).ExecuteDeleteAsync(ct) == 0)
        {
            return Results.NotFound();
        }

        await transacao.CommitAsync(ct);

        return Results.NoContent();
    }

    private static IResult? RecusaPropriaConta(Guid id, ClaimsPrincipal usuarioLogado) =>
        PropriaConta.Eh(usuarioLogado, id)
            ? PropriaConta.Problema("Você não pode excluir a sua própria conta: ficaria sem acesso.")
            : null;
}
