using CartSchedule.Api.Infrastructure;
using CartSchedule.Api.Infrastructure.Auth;
using CartSchedule.Api.Infrastructure.RateLimiting;
using CartSchedule.Api.Shared;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace CartSchedule.Api.Features.Autenticacao.Login;

/// <summary>
/// POST /api/login — login único (ADR 0001). Primeiro confere o administrador de recuperação
/// (Admin:Usuario / Admin:SenhaHash, do servidor; usuário comparado como o dos publicadores,
/// sem maiúsculas, acentos nem espaços nas pontas); senão, o publicador pelo usuário
/// normalizado e o PIN. Usuário inexistente, PIN errado e conta sem PIN dão a mesma resposta
/// (401 CREDENCIAIS_INVALIDAS). Sem bloqueio de conta: a única proteção contra adivinhar o
/// PIN é o rate limit "login" por IP.
/// </summary>
public static class Endpoint
{
    public const string CodigoCredenciaisInvalidas = "CREDENCIAIS_INVALIDAS";

    private static readonly string HashSemConta =
        new PasswordHasher<object>().HashPassword(new object(), Guid.NewGuid().ToString());

    public static IEndpointRouteBuilder MapLogin(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/login", HandleAsync)
            .AddEndpointFilter<ValidationFilter<LoginRequest>>()
            .AllowAnonymous()
            .RequireRateLimiting(RateLimitingExtensions.PoliticaLogin)
            .WithName("Login");

        return app;
    }

    private static async Task<IResult> HandleAsync(
        LoginRequest request,
        AppDbContext db,
        [FromServices] IOptions<AdminCredentialsOptions> adminOptions,
        [FromServices] PasswordHasher<object> passwordHasher,
        [FromServices] IJwtTokenService jwtTokenService,
        CancellationToken ct)
    {
        var recuperacao = adminOptions.Value;
        if (!string.IsNullOrEmpty(recuperacao.Usuario)
            && !string.IsNullOrEmpty(recuperacao.SenhaHash)
            && UsuarioNormalizado.De(request.Usuario) == UsuarioNormalizado.De(recuperacao.Usuario)
            && passwordHasher.VerifyHashedPassword(new object(), recuperacao.SenhaHash, request.Pin)
                != PasswordVerificationResult.Failed)
        {
            return Results.Ok(new SessaoResponse(
                jwtTokenService.GerarTokenDeRecuperacao(recuperacao.Usuario), Papeis.Recuperacao));
        }

        var usuario = UsuarioNormalizado.De(request.Usuario);
        var publicador = await db.Publicadores
            .AsNoTracking()
            .SingleOrDefaultAsync(p => p.UsuarioNormalizado == usuario, ct);

        // Sem conta ou sem PIN, confere contra um hash qualquer: o tempo de resposta não revela
        // se o usuário existe.
        var pinConfere = passwordHasher.VerifyHashedPassword(
            new object(), publicador?.PinHash ?? HashSemConta, request.Pin) != PasswordVerificationResult.Failed;
        if (publicador?.PinHash is null || !pinConfere)
        {
            return Results.Problem(
                title: "Usuário ou PIN inválidos.",
                statusCode: StatusCodes.Status401Unauthorized,
                extensions: new Dictionary<string, object?> { ["codigo"] = CodigoCredenciaisInvalidas });
        }

        return Results.Ok(SessaoDoPublicador.Emitir(publicador, jwtTokenService));
    }
}
