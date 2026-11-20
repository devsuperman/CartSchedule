using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace CartSchedule.Api.Infrastructure.Auth;

/// <summary>Valores do claim de papel (<see cref="ClaimTypes.Role"/>) nos tokens de login.</summary>
public static class Papeis
{
    public const string Publicador = "publicador";
    public const string Administrador = "administrador";

    /// <summary>Administrador de recuperação: credenciais do servidor, não é um publicador.</summary>
    public const string Recuperacao = "recuperacao";
}

/// <summary>Claims próprios dos tokens de publicador.</summary>
public static class ClaimsDaSessao
{
    public const string VersaoSessao = "versaoSessao";
}

/// <summary>
/// Emite o JWT do login (TECHNICAL_SPEC.md §2.2), assinado com HMAC SHA256 usando a chave em
/// Jwt:ChaveSecreta. Administrador e administrador de recuperação: 2 horas; publicador: 180 dias.
/// </summary>
public interface IJwtTokenService
{
    string GerarTokenDeRecuperacao(string usuario);

    string GerarTokenDePublicador(Guid publicadorId, string nome, int versaoSessao, bool administrador);
}

public class JwtTokenService : IJwtTokenService
{
    private static readonly TimeSpan DuracaoAdministrador = TimeSpan.FromHours(2);
    private static readonly TimeSpan DuracaoPublicador = TimeSpan.FromDays(180);

    private readonly JwtOptions _jwtOptions;
    private readonly TimeProvider _relogio;

    public JwtTokenService(IOptions<JwtOptions> jwtOptions, TimeProvider relogio)
    {
        _jwtOptions = jwtOptions.Value;
        _relogio = relogio;
    }

    public string GerarTokenDeRecuperacao(string usuario) =>
        Gerar(
            [new Claim(ClaimTypes.Name, usuario), new Claim(ClaimTypes.Role, Papeis.Recuperacao)],
            DuracaoAdministrador);

    public string GerarTokenDePublicador(Guid publicadorId, string nome, int versaoSessao, bool administrador) =>
        Gerar(
            [
                new Claim(ClaimTypes.NameIdentifier, publicadorId.ToString()),
                new Claim(ClaimTypes.Name, nome),
                new Claim(ClaimsDaSessao.VersaoSessao, versaoSessao.ToString(), ClaimValueTypes.Integer32),
                new Claim(ClaimTypes.Role, administrador ? Papeis.Administrador : Papeis.Publicador),
            ],
            administrador ? DuracaoAdministrador : DuracaoPublicador);

    private string Gerar(Claim[] claims, TimeSpan duracao)
    {
        var credenciaisAssinatura = new SigningCredentials(
            AuthSigningKey.CriarChave(_jwtOptions.ChaveSecreta),
            SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            claims: claims,
            expires: _relogio.GetUtcNow().UtcDateTime.Add(duracao),
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
