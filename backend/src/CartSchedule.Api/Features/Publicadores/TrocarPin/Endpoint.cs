using System.Security.Claims;
using CartSchedule.Api.Infrastructure;
using CartSchedule.Api.Infrastructure.Auth;
using CartSchedule.Api.Infrastructure.RateLimiting;
using CartSchedule.Api.Shared;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CartSchedule.Api.Features.Publicadores.TrocarPin;

/// <summary>
/// PUT /api/eu/pin — o publicador troca o próprio PIN pelo menu "Olá" (issue #50), informando o
/// atual. O novo tem 4 dígitos e não pode ser óbvio (<see cref="Pin.EhFraco"/>). Incrementa
/// <c>VersaoSessao</c>, desconectando os outros aparelhos, e devolve um token novo para o
/// aparelho atual continuar logado. PIN atual errado é 400 (não 401): a sessão continua válida.
/// Com o rate limit "login" por IP, como o login: o PIN atual não vira um jeito de adivinhar PINs.
/// </summary>
public static class Endpoint
{
    public const string CodigoPinAtualInvalido = "PIN_ATUAL_INVALIDO";
    public const string CodigoPinFraco = "PIN_FRACO";

    public static IEndpointRouteBuilder MapTrocarPin(this IEndpointRouteBuilder app)
    {
        app.MapPut("/api/eu/pin", HandleAsync)
            .AddEndpointFilter<ValidationFilter<TrocarPinRequest>>()
            .RequireAuthorization(Politicas.Publicador)
            .RequireRateLimiting(RateLimitingExtensions.PoliticaLogin)
            .WithName("TrocarPin");

        return app;
    }

    private static async Task<IResult> HandleAsync(
        TrocarPinRequest request,
        ClaimsPrincipal usuarioLogado,
        AppDbContext db,
        [FromServices] PasswordHasher<object> passwordHasher,
        [FromServices] IJwtTokenService jwtTokenService,
        CancellationToken ct)
    {
        var publicadorId = usuarioLogado.PublicadorId();

        await using var transacao = await db.Database.BeginTransactionAsync(ct);
        // FOR UPDATE: uma redefinição do administrador ao mesmo tempo espera esta troca (ou o
        // contrário) — o token devolvido nunca carrega uma versão de sessão que já foi encerrada.
        var publicador = await db.Publicadores
            .FromSql($"SELECT * FROM publicadores WHERE \"Id\" = {publicadorId} FOR UPDATE")
            .SingleAsync(ct);

        if (publicador.PinHash is null
            || passwordHasher.VerifyHashedPassword(new object(), publicador.PinHash, request.PinAtual)
                == PasswordVerificationResult.Failed)
        {
            return Problema("A senha atual não confere.", CodigoPinAtualInvalido);
        }

        if (Pin.EhFraco(request.PinNovo))
        {
            return Problema(
                "Essa senha é fácil de adivinhar. Evite números todos iguais ou em sequência (como 1234).",
                CodigoPinFraco);
        }

        publicador.PinHash = passwordHasher.HashPassword(new object(), request.PinNovo);
        publicador.VersaoSessao++;
        await db.SaveChangesAsync(ct);
        await transacao.CommitAsync(ct);

        return Results.Ok(SessaoDoPublicador.Emitir(publicador, jwtTokenService));
    }

    private static IResult Problema(string titulo, string codigo) =>
        Results.Problem(
            title: titulo,
            statusCode: StatusCodes.Status400BadRequest,
            extensions: new Dictionary<string, object?> { ["codigo"] = codigo });
}
