using CartSchedule.Api.Domain.Enums;

namespace CartSchedule.Api.Domain;

/// <summary>
/// Associação: quais dos 6 turnos fixos cada carrinho tem disponível em cada dia da
/// semana (PLANNING.md regra 17 — ex: 08:00–10:00 só na Segunda). Chave composta
/// (CarrinhoId, DiaSemana, TurnoId) configurada em AppDbContext.
/// </summary>
public class CarrinhoTurno
{
    public int CarrinhoId { get; set; }

    public Carrinho Carrinho { get; set; } = null!;

    public DiaSemana DiaSemana { get; set; }

    public int TurnoId { get; set; }

    public Turno Turno { get; set; } = null!;
}
