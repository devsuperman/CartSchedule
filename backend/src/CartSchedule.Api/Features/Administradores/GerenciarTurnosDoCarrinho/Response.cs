using CartSchedule.Api.Domain.Enums;

namespace CartSchedule.Api.Features.Administradores.GerenciarTurnosDoCarrinho;

public class TurnosDoCarrinhoResponse
{
    public int CarrinhoId { get; set; }

    public List<DisponibilidadeResponse> Disponibilidades { get; set; } = [];
}

public record DisponibilidadeResponse(DiaSemana DiaSemana, int TurnoId);
