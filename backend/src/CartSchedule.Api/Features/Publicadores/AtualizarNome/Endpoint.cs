using CartSchedule.Api.Infrastructure;
using CartSchedule.Api.Infrastructure.RateLimiting;
using CartSchedule.Api.Shared;
using Microsoft.EntityFrameworkCore;

namespace CartSchedule.Api.Features.Publicadores.AtualizarNome;

/// <summary>
/// PUT /api/publicador — o publicador (header X-Publicador-Token) corrige o próprio nome, que
/// passa a valer na hora para o administrador (revisão e grade). Se ele ainda não fez nenhum
/// pedido, não existe no banco: nada é criado e o nome chega junto com o primeiro pedido.
/// Mudar o nome não é pedir escala, então não depende da janela de envio.
/// </summary>
public static class Endpoint
{
    public static IEndpointRouteBuilder MapAtualizarNome(this IEndpointRouteBuilder app)
    {
        app.MapPut("/api/publicador", HandleAsync)
            .AddEndpointFilter<ValidationFilter<Request>>()
            .RequireRateLimiting(RateLimitingExtensions.PoliticaEscritaPublicador);

        return app;
    }

    private static async Task<IResult> HandleAsync(
        HttpContext httpContext, AppDbContext db, Request request, CancellationToken ct)
    {
        if (!httpContext.Request.Headers.TryGetValue("X-Publicador-Token", out var tokenHeader)
            || !Guid.TryParse(tokenHeader, out var publicadorId))
        {
            return Results.Problem(
                title: "Token de publicador ausente ou inválido",
                detail: "Envie o header X-Publicador-Token com um GUID válido.",
                statusCode: StatusCodes.Status400BadRequest);
        }

        var nome = request.Nome.Trim();
        await db.Publicadores
            .Where(p => p.Id == publicadorId)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.Nome, nome), ct);

        return Results.NoContent();
    }
}
