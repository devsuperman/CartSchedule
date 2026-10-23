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

    /// <summary>
    /// Carrinho de data especial (PLANNING.md regra 10a): funciona só nesta data (Segunda a
    /// Sexta), com turnos apenas no dia da semana dela, e aparece só na escala do mês dela.
    /// Pedidos nele não ocupam o horário da escala semanal (nem o contrário). Null = carrinho
    /// normal, recorrente.
    /// </summary>
    public DateOnly? DataEspecial { get; set; }

    public List<CarrinhoTurno> CarrinhoTurnos { get; set; } = [];

    public List<Solicitacao> Solicitacoes { get; set; } = [];
}
