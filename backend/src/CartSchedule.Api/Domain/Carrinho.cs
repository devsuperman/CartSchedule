namespace CartSchedule.Api.Domain;

public class Carrinho
{
    public int Id { get; set; }

    public string Nome { get; set; } = string.Empty;

    /// <summary>
    /// Texto livre opcional (ex: local onde o carrinho fica), exibido ao publicador
    /// abaixo do nome na hora de escolher o carrinho.
    /// </summary>
    public string? Descricao { get; set; }

    public bool Ativo { get; set; } = true;

    public List<CarrinhoTurno> CarrinhoTurnos { get; set; } = [];

    public List<Solicitacao> Solicitacoes { get; set; } = [];
}
