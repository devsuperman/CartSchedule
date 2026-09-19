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

    public StatusSolicitacao Status { get; set; } = StatusSolicitacao.Pendente;

    public OrigemSolicitacao Origem { get; set; }

    public DateTimeOffset CriadoEm { get; set; }

    public DateTimeOffset? DecididoEm { get; set; }
}
