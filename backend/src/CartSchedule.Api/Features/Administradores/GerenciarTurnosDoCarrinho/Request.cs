using CartSchedule.Api.Domain.Enums;

namespace CartSchedule.Api.Features.Administradores.GerenciarTurnosDoCarrinho;

/// <summary>
/// Corpo do PUT /api/admin/carrinhos/{id}/turnos — substituição completa do
/// conjunto de disponibilidades (dia da semana × turno) do carrinho. Os turnos
/// devem pertencer ao conjunto fixo de 6 do sistema (validado no handler, ver Endpoint.cs).
/// </summary>
public class AtualizarTurnosDoCarrinhoRequest
{
    public List<DisponibilidadeRequest> Disponibilidades { get; set; } = [];
}

public record DisponibilidadeRequest(DiaSemana DiaSemana, int TurnoId);
