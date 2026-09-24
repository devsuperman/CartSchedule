using CartSchedule.Api.Infrastructure;
using CartSchedule.Api.Shared;
using Microsoft.EntityFrameworkCore;

namespace CartSchedule.Api.Features.Administradores.RenomearPublicador;

/// <summary>
/// PUT /api/admin/publicadores/{id} — o administrador corrige o nome de um publicador. O nome
/// é do registro Publicador, então muda em todos os pedidos dele, de todas as escalas. Nomes
/// repetidos são permitidos (o único bloqueio do sistema é o pedido duplicado — PLANNING.md
/// regra 10). Se depois o publicador enviar um pedido ou editar o próprio nome, o nome salvo
/// no aparelho dele volta a valer.
/// </summary>
public static class Endpoint
{
    public static IEndpointRouteBuilder MapRenomearPublicador(this IEndpointRouteBuilder app)
    {
        app.MapPut("/api/admin/publicadores/{id:guid}", HandleAsync)
            .AddEndpointFilter<ValidationFilter<Request>>()
            .RequireAuthorization();

        return app;
    }

    private static async Task<IResult> HandleAsync(Guid id, Request request, AppDbContext db, CancellationToken ct)
    {
        var nome = request.Nome.Trim();
        var alterados = await db.Publicadores
            .Where(p => p.Id == id)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.Nome, nome), ct);

        return alterados == 0 ? Results.NotFound() : Results.NoContent();
    }
}
