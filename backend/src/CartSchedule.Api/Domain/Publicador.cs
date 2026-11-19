namespace CartSchedule.Api.Domain;

/// <summary>
/// Pessoa que pede vagas na escala (GLOSSARY.md). Registros antigos, criados pelo token
/// anônimo do aparelho ou pela adição manual por nome, ficam sem <see cref="Usuario"/> e sem
/// PIN até o administrador criar as credenciais (ADR 0001) — o id e o histórico se mantêm.
/// </summary>
public class Publicador
{
    public Guid Id { get; set; }

    /// <summary>Como aparece na escala; só o administrador altera.</summary>
    public string Nome { get; set; } = string.Empty;

    /// <summary>
    /// Criança ou idoso: pode ser a 3ª pessoa de uma vaga sem que ela fique com excesso
    /// (PLANNING.md regra 1). Só o administrador marca; o sistema nunca bloqueia por isso.
    /// </summary>
    public bool CriancaOuIdoso { get; set; }

    /// <summary>Usuário de login, como o administrador digitou (exibição).</summary>
    public string? Usuario { get; set; }

    /// <summary>
    /// <see cref="Usuario"/> sem maiúsculas e sem acentos (<c>Shared.UsuarioNormalizado</c>),
    /// com índice único: "maria" e "María" são o mesmo usuário.
    /// </summary>
    public string? UsuarioNormalizado { get; set; }

    /// <summary>Hash do PIN de 4 dígitos (PasswordHasher do ASP.NET); nunca o PIN em claro.</summary>
    public string? PinHash { get; set; }

    /// <summary>Pode entrar na área administrativa; continua podendo pedir vagas.</summary>
    public bool Administrador { get; set; }

    public bool Ativo { get; set; } = true;

    /// <summary>
    /// Vai no token; incrementar invalida as sessões abertas (redefinir/trocar PIN, desativar).
    /// </summary>
    public int VersaoSessao { get; set; }

    public List<Solicitacao> Solicitacoes { get; set; } = [];
}
