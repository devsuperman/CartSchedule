namespace CartSchedule.Api.Domain;

/// <summary>
/// Associação: quais dos 6 turnos fixos cada carrinho tem disponível. Chave composta
/// (CarrinhoId, TurnoId) configurada em AppDbContext.
/// </summary>
public class CarrinhoTurno
{
    public int CarrinhoId { get; set; }

    public Carrinho Carrinho { get; set; } = null!;

    public int TurnoId { get; set; }

    public Turno Turno { get; set; } = null!;
}
