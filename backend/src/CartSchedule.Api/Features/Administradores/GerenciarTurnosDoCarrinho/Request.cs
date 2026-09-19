namespace CartSchedule.Api.Features.Administradores.GerenciarTurnosDoCarrinho;

/// <summary>
/// Corpo do PUT /api/admin/carrinhos/{id}/turnos — substituição completa do
/// conjunto de turnos habilitados para o carrinho. Os ids devem pertencer ao
/// conjunto fixo de 6 turnos do sistema (validado no handler, ver Endpoint.cs).
/// </summary>
public class AtualizarTurnosDoCarrinhoRequest
{
    public List<int> TurnoIds { get; set; } = [];
}
