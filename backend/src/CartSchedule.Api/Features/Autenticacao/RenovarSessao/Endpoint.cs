using System.Security.Claims;
using CartSchedule.Api.Infrastructure;
using CartSchedule.Api.Infrastructure.Auth;
using CartSchedule.Api.Shared;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CartSchedule.Api.Features.Autenticacao.RenovarSessao;

/// <summary>
/// POST /api/sessao/renovar — o frontend chama ao abrir o app e recebe um token novo com a
/// validade cheia (publicador: 180 dias; administrador: 2 h), sem refresh token. O papel vem da
/// conta atual, não do token antigo (quem ganhou a marca de administrador passa a tê-la aqui).
/// Só para contas de publicador: o administrador de recuperação entra de novo pelo login (403).
/// </summary>
public static class Endpoint
{
    public static IEndpointRouteBuilder MapRenovarSessao(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/sessao/renovar", HandleAsync)
            .RequireAuthorization(Politicas.Publicador)
            .WithName("RenovarSessao");

        return app;
    }

    private static async Task<IResult> HandleAsync(
        ClaimsPrincipal usuarioLogado,
        AppDbContext db,
        [FromServices] IJwtTokenService jwtTokenService,
        CancellationToken ct)
    {
        var publicadorId = usuarioLogado.PublicadorId();
        // ValidacaoDaSessao já conferiu que a conta existe, está ativa e a versão da sessão é a atual.
        var publicador = await db.Publicadores
            .AsNoTracking()
            .SingleAsync(p => p.Id == publicadorId, ct);

        return Results.Ok(SessaoDoPublicador.Emitir(publicador, jwtTokenService));
    }
}
