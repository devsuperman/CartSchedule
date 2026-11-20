using CartSchedule.Api.Domain;
using CartSchedule.Api.Infrastructure.Auth;

namespace CartSchedule.Api.Shared;

/// <summary>
/// Resposta de quem recebe uma sessão (login, renovação, troca de PIN): o JWT e o papel
/// (<c>Papeis</c>: publicador, administrador ou recuperacao), que o frontend guarda.
/// </summary>
public record SessaoResponse(string Token, string Papel);

/// <summary>
/// Sessão de uma conta de publicador (ADR 0001): token com a <c>VersaoSessao</c> atual e o papel
/// tirado da conta, não de um token antigo — quem ganhou a marca de administrador passa a tê-la.
/// </summary>
public static class SessaoDoPublicador
{
    public static SessaoResponse Emitir(Publicador publicador, IJwtTokenService jwtTokenService) =>
        new(
            jwtTokenService.GerarTokenDePublicador(
                publicador.Id, publicador.Nome, publicador.VersaoSessao, publicador.Administrador),
            publicador.Administrador ? Papeis.Administrador : Papeis.Publicador);
}
