using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.Tokens;

namespace CartSchedule.Api.Infrastructure.Auth;

/// <summary>
/// Wiring de autenticação (login único de administradores e publicadores, ADR 0001). Program.cs chama
/// <see cref="AddAdminAuthentication"/> no registro de serviços e
/// <see cref="UseAdminAuth"/> no pipeline (antes do login e de
/// qualquer grupo de rotas administrativas com .RequireAuthorization()).
/// </summary>
public static class AuthServiceCollectionExtensions
{
    public static IServiceCollection AddAdminAuthentication(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<AdminCredentialsOptions>(configuration.GetSection(AdminCredentialsOptions.SectionName));
        services.Configure<JwtOptions>(configuration.GetSection(JwtOptions.SectionName));

        services.AddSingleton<PasswordHasher<object>>();
        services.AddSingleton<IJwtTokenService, JwtTokenService>();

        var chaveSecreta = configuration[$"{JwtOptions.SectionName}:{nameof(JwtOptions.ChaveSecreta)}"] ?? string.Empty;

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = false,
                    ValidateAudience = false,
                    ValidateLifetime = true,
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = AuthSigningKey.CriarChave(chaveSecreta),
                    ClockSkew = TimeSpan.FromMinutes(1),
                };
                options.Events = new JwtBearerEvents
                {
                    OnTokenValidated = ValidacaoDaSessao.AoValidarTokenAsync,
                };
            });

        // Toda rota com .RequireAuthorization() é administrativa: só administrador ou o
        // administrador de recuperação. O publicador comum, mesmo logado, recebe 403.
        services.AddAuthorizationBuilder()
            .SetDefaultPolicy(new AuthorizationPolicyBuilder(JwtBearerDefaults.AuthenticationScheme)
                .RequireRole(Papeis.Administrador, Papeis.Recuperacao)
                .Build());

        return services;
    }

    public static WebApplication UseAdminAuth(this WebApplication app)
    {
        app.UseAuthentication();
        app.UseAuthorization();
        return app;
    }
}
