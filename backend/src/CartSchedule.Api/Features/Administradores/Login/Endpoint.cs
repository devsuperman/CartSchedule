using CartSchedule.Api.Infrastructure.Auth;
using CartSchedule.Api.Shared;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace CartSchedule.Api.Features.Administradores.Login;

/// <summary>
/// POST /api/admin/login — valida usuário/senha do único administrador
/// (Admin:Usuario / Admin:SenhaHash) e emite um JWT curto em caso de
/// sucesso (TECHNICAL_SPEC.md §2.2, PLANNING.md regra 15). Rota pública
/// (sem RequireAuthorization) — é o próprio ponto de entrada da
/// autenticação.
/// </summary>
public static class Endpoint
{
    public static IEndpointRouteBuilder MapLogin(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/admin/login", Handle)
            .AddEndpointFilter<ValidationFilter<LoginRequest>>()
            .AllowAnonymous()
            .WithName("AdminLogin");

        return app;
    }

    private static IResult Handle(
        LoginRequest request,
        [FromServices] IOptions<AdminCredentialsOptions> adminOptions,
        [FromServices] PasswordHasher<object> passwordHasher,
        [FromServices] IJwtTokenService jwtTokenService)
    {
        var credenciais = adminOptions.Value;

        if (string.IsNullOrEmpty(credenciais.Usuario) || string.IsNullOrEmpty(credenciais.SenhaHash))
        {
            return CredenciaisInvalidas();
        }

        if (!string.Equals(request.Usuario, credenciais.Usuario, StringComparison.Ordinal))
        {
            return CredenciaisInvalidas();
        }

        var resultadoVerificacao = passwordHasher.VerifyHashedPassword(new object(), credenciais.SenhaHash, request.Senha);
        if (resultadoVerificacao == PasswordVerificationResult.Failed)
        {
            return CredenciaisInvalidas();
        }

        var token = jwtTokenService.GerarToken(credenciais.Usuario);
        return Results.Ok(new LoginResponse(token));
    }

    private static IResult CredenciaisInvalidas() =>
        Results.Problem(
            title: "Usuário ou senha inválidos.",
            statusCode: StatusCodes.Status401Unauthorized);
}
