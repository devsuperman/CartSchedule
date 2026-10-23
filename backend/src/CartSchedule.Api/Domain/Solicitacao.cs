using CartSchedule.Api.Domain.Enums;

namespace CartSchedule.Api.Domain;

public class Solicitacao
{
    public int Id { get; set; }

    public Guid PublicadorId { get; set; }

    public Publicador Publicador { get; set; } = null!;

    public int EscalaId { get; set; }

    public Escala Escala { get; set; } = null!;

    public int CarrinhoId { get; set; }

    public Carrinho Carrinho { get; set; } = null!;

    public DiaSemana DiaSemana { get; set; }

    public int TurnoId { get; set; }

    public Turno Turno { get; set; } = null!;

    /// <summary>
    /// Data especial do carrinho no momento do pedido (PLANNING.md regra 10a); null = carrinho
    /// normal. Define o grupo de horário ocupado do publicador. É gravado aqui, e não lido do
    /// carrinho, para que mudar a data de um carrinho não mude o grupo de pedidos já feitos.
    /// </summary>
    public DateOnly? DataEspecial { get; set; }

    public OrigemSolicitacao Origem { get; set; }

    public DateTimeOffset CriadoEm { get; set; }
}
