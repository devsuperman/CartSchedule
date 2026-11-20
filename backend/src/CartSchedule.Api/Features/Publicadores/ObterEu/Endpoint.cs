using System.Security.Claims;
using CartSchedule.Api.Infrastructure;
using CartSchedule.Api.Infrastructure.Auth;
using Microsoft.EntityFrameworkCore;

namespace CartSchedule.Api.Features.Publicadores.ObterEu;

/// <summary>
/// GET /api/eu — dados da conta logada para o cabeçalho ("Olá, {primeiro nome}") e o link
/// "Administração". Só leitura: o nome e o usuário só o administrador altera.
/// </summary>
public static class Endpoint
{
    public static IEndpointRouteBuilder MapObterEu(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/eu", async (ClaimsPrincipal usuarioLogado, AppDbContext db, CancellationToken ct) =>
        {
            var publicadorId = usuarioLogado.PublicadorId();
            var eu = await db.Publicadores
                .AsNoTracking()
                .Where(p => p.Id == publicadorId)
                .Select(p => new Response(p.Id, p.Nome, p.Usuario, p.Administrador))
                .SingleAsync(ct);

            return Results.Ok(eu);
        })
        .RequireAuthorization(Politicas.Publicador);

        return app;
    }
}
