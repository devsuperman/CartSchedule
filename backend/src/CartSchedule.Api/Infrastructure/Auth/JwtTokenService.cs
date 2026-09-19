using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace CartSchedule.Api.Infrastructure.Auth;

/// <summary>
/// Emite o JWT curto do administrador após um login bem-sucedido
/// (TECHNICAL_SPEC.md §2.2 — 2 horas de validade, assinado com HMAC SHA256
/// usando a chave em Jwt:ChaveSecreta).
/// </summary>
public interface IJwtTokenService
{
    string GerarToken(string usuario);
}

public class JwtTokenService : IJwtTokenService
{
    private static readonly TimeSpan DuracaoToken = TimeSpan.FromHours(2);

    private readonly JwtOptions _jwtOptions;

    public JwtTokenService(IOptions<JwtOptions> jwtOptions)
    {
        _jwtOptions = jwtOptions.Value;
    }

    public string GerarToken(string usuario)
    {
        var credenciaisAssinatura = new SigningCredentials(
            AuthSigningKey.CriarChave(_jwtOptions.ChaveSecreta),
            SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(ClaimTypes.Name, usuario),
            new Claim(ClaimTypes.Role, "Administrador"),
        };

        var token = new JwtSecurityToken(
            claims: claims,
            expires: DateTime.UtcNow.Add(DuracaoToken),
            signingCredentials: credenciaisAssinatura);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

/// <summary>
/// Ponto único de construção da chave simétrica de assinatura, compartilhado
/// entre a emissão do token (<see cref="JwtTokenService"/>) e a validação no
/// middleware de autenticação (<see cref="AuthServiceCollectionExtensions"/>),
/// para garantir que ambos usam exatamente a mesma chave.
/// </summary>
internal static class AuthSigningKey
{
    private const int TamanhoMinimoEmBytes = 32;

    public static SymmetricSecurityKey CriarChave(string chaveSecreta)
    {
        // Em ambientes sem Jwt:ChaveSecreta configurada (ex: build/dev sem
        // .env), evita estourar ArgumentException por chave vazia/curta —
        // em produção a chave real vem sempre da env var Jwt__ChaveSecreta.
        var chaveEfetiva = string.IsNullOrEmpty(chaveSecreta)
            ? new string('0', TamanhoMinimoEmBytes)
            : chaveSecreta.PadRight(TamanhoMinimoEmBytes, '0');

        return new SymmetricSecurityKey(Encoding.UTF8.GetBytes(chaveEfetiva));
    }
}
