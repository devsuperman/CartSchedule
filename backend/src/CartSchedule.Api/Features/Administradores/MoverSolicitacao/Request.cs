using CartSchedule.Api.Domain.Enums;

namespace CartSchedule.Api.Features.Administradores.MoverSolicitacao;

/// <summary>Vaga de destino da solicitação: a trinca (carrinho, dia da semana, turno).</summary>
public record Request(int CarrinhoId, DiaSemana DiaSemana, int TurnoId);
