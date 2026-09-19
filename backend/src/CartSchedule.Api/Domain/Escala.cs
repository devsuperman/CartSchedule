namespace CartSchedule.Api.Domain;

public class Escala
{
    public int Id { get; set; }

    /// <summary>Primeiro dia do mês de referência (ex: 2026-10-01 para Outubro/2026).</summary>
    public DateOnly MesReferencia { get; set; }

    public List<Solicitacao> Solicitacoes { get; set; } = [];
}
