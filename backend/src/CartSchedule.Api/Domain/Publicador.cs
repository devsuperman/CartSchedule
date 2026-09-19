namespace CartSchedule.Api.Domain;

/// <summary>
/// Identificado pelo token anônimo (X-Publicador-Token), gerado no frontend ou pelo backend
/// quando criado via adição manual do administrador (TECHNICAL_SPEC.md §2.3).
/// </summary>
public class Publicador
{
    public Guid Id { get; set; }

    public string Nome { get; set; } = string.Empty;

    public List<Solicitacao> Solicitacoes { get; set; } = [];
}
