using System.Security.Claims;
using CartSchedule.Api.Infrastructure.Auth;

namespace CartSchedule.Api.Shared;

/// <summary>
/// O que o administrador não faz na própria conta, porque ficaria sem acesso (desativar, tirar o
/// administrador, unir a outra, excluir): 409 com este código.
/// </summary>
public static class PropriaConta
{
    public const string Codigo = "PROPRIA_CONTA";

    /// <summary>A conta é a do administrador logado? Nunca para o administrador de recuperação.</summary>
    public static bool Eh(ClaimsPrincipal usuarioLogado, Guid publicadorId) =>
        usuarioLogado.PublicadorIdOuNulo() == publicadorId;

    public static IResult Problema(string mensagem) =>
        Results.Problem(
            title: mensagem,
            statusCode: StatusCodes.Status409Conflict,
            extensions: new Dictionary<string, object?> { ["codigo"] = Codigo });
}
