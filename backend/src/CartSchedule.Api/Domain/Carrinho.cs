namespace CartSchedule.Api.Domain;

public class Carrinho
{
    public int Id { get; set; }

    public string Nome { get; set; } = string.Empty;

    public bool Ativo { get; set; } = true;

    public List<CarrinhoTurno> CarrinhoTurnos { get; set; } = [];

    public List<Solicitacao> Solicitacoes { get; set; } = [];
}
