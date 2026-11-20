using System.Security.Claims;

namespace CartSchedule.Api.Infrastructure.Auth;

/// <summary>Nomes das políticas de autorização além da padrão (administrativa).</summary>
public static class Politicas
{
    /// <summary>
    /// Rotas do publicador (pedir, excluir, histórico, janela, carrinhos, /api/eu): publicador ou
    /// administrador. Sem token → 401; administrador de recuperação → 403.
    /// </summary>
    public const string Publicador = "publicador";
}

public static class UsuarioLogado
{
    /// <summary>
    /// Id do publicador dono do token. Só chamar em rotas com a política
    /// <see cref="Politicas.Publicador"/>, que garante o claim (e <c>ValidacaoDaSessao</c>, que a
    /// conta existe e está ativa).
    /// </summary>
    public static Guid PublicadorId(this ClaimsPrincipal usuario) =>
        Guid.Parse(usuario.FindFirstValue(ClaimTypes.NameIdentifier)!);
}
