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
/// (Admin:Usuario / Admin:SenhaHash, do servidor); senão, o publicador pelo usuário
/// normalizado e o PIN. Usuário inexistente, PIN errado e conta sem PIN dão a mesma resposta
/// (401 CREDENCIAIS_INVALIDAS). Sem bloqueio de conta: a única proteção contra adivinhar o
/// PIN é o rate limit "login" por IP.
/// </summary>
public static class Endpoint
{
    public const string CodigoCredenciaisInvalidas = "CREDENCIAIS_INVALIDAS";
    public const string CodigoPublicadorInativo = "PUBLICADOR_INATIVO";

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
            && string.Equals(request.Usuario, recuperacao.Usuario, StringComparison.Ordinal)
            && passwordHasher.VerifyHashedPassword(new object(), recuperacao.SenhaHash, request.Pin)
                != PasswordVerificationResult.Failed)
        {
            return Results.Ok(new LoginResponse(
                jwtTokenService.GerarTokenDeRecuperacao(recuperacao.Usuario), Papeis.Recuperacao));
        }

        var usuario = UsuarioNormalizado.De(request.Usuario);
        var publicador = await db.Publicadores
            .AsNoTracking()
            .SingleOrDefaultAsync(p => p.UsuarioNormalizado == usuario, ct);

        if (publicador?.PinHash is null
            || passwordHasher.VerifyHashedPassword(new object(), publicador.PinHash, request.Pin)
                == PasswordVerificationResult.Failed)
        {
            return Results.Problem(
                title: "Usuário ou PIN inválidos.",
                statusCode: StatusCodes.Status401Unauthorized,
                extensions: new Dictionary<string, object?> { ["codigo"] = CodigoCredenciaisInvalidas });
        }

        if (!publicador.Ativo)
        {
            return Results.Problem(
                title: "Seu acesso está desativado. Fale com o administrador.",
                statusCode: StatusCodes.Status403Forbidden,
                extensions: new Dictionary<string, object?> { ["codigo"] = CodigoPublicadorInativo });
        }

        var token = jwtTokenService.GerarTokenDePublicador(
            publicador.Id, publicador.Nome, publicador.VersaoSessao, publicador.Administrador);
        return Results.Ok(new LoginResponse(
            token, publicador.Administrador ? Papeis.Administrador : Papeis.Publicador));
    }
}
