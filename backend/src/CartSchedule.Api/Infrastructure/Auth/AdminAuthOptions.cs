namespace CartSchedule.Api.Infrastructure.Auth;

/// <summary>
/// Credenciais do único administrador do sistema, vindas da seção de
/// configuração "Admin" (env vars <c>Admin__Usuario</c> /
/// <c>Admin__SenhaHash</c> em produção — ver TECHNICAL_SPEC.md §2.2 e
/// §5.4). A senha nunca é armazenada em texto puro: <see cref="SenhaHash"/>
/// é o hash gerado por <see cref="Microsoft.AspNetCore.Identity.PasswordHasher{TUser}"/>.
/// </summary>
public class AdminCredentialsOptions
{
    public const string SectionName = "Admin";

    public string Usuario { get; set; } = string.Empty;

    public string SenhaHash { get; set; } = string.Empty;
}

/// <summary>
/// Configuração de assinatura do JWT emitido no login do administrador,
/// vinda da seção de configuração "Jwt" (env var <c>Jwt__ChaveSecreta</c>
/// em produção).
/// </summary>
public class JwtOptions
{
    public const string SectionName = "Jwt";

    public string ChaveSecreta { get; set; } = string.Empty;
}
