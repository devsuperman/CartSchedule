namespace CartSchedule.Api.Domain;

/// <summary>
/// Identificado pelo token anônimo (X-Publicador-Token), gerado no frontend ou pelo backend
/// quando criado via adição manual do administrador (TECHNICAL_SPEC.md §2.3).
/// </summary>
public class Publicador
{
    public Guid Id { get; set; }

    public string Nome { get; set; } = string.Empty;

    /// <summary>
    /// Criança ou idoso: pode ser a 3ª pessoa de uma vaga sem que ela fique com excesso
    /// (PLANNING.md regra 1). Só o administrador marca; o sistema nunca bloqueia por isso.
    /// </summary>
    public bool CriancaOuIdoso { get; set; }

    public List<Solicitacao> Solicitacoes { get; set; } = [];
}
