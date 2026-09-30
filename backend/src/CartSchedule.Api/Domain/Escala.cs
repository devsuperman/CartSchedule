namespace CartSchedule.Api.Domain;

public class Escala
{
    public int Id { get; set; }

    /// <summary>Primeiro dia do mês de referência (ex: 2026-10-01 para Outubro/2026).</summary>
    public DateOnly MesReferencia { get; set; }

    /// <summary>
    /// True quando o administrador fechou o envio de pedidos dos publicadores para esta escala
    /// (PLANNING.md §4). O envio abre sozinho no dia 15 e só fecha por ação do administrador,
    /// que pode reabri-lo — ver <c>Shared/JanelaDeEnvio.cs</c>.
    /// </summary>
    public bool EnvioFechado { get; set; }

    public List<Solicitacao> Solicitacoes { get; set; } = [];
}
