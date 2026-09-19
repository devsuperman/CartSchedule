namespace CartSchedule.Api.Domain;

/// <summary>
/// Fixos do sistema, não cadastráveis pelo administrador — sempre os 6 turnos
/// inseridos pela migration de seed (PLANNING.md regra 20).
/// </summary>
public class Turno
{
    public int Id { get; set; }

    public TimeOnly HoraInicio { get; set; }

    public TimeOnly HoraFim { get; set; }

    public List<CarrinhoTurno> CarrinhoTurnos { get; set; } = [];

    public List<Solicitacao> Solicitacoes { get; set; } = [];
}
