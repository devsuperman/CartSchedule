using CartSchedule.Api.Domain.Enums;

namespace CartSchedule.Api.Features.Administradores.GerenciarCarrinhos;

/// <summary>
/// Representação de um carrinho para o painel do administrador. Disponibilidades é um campo
/// de conveniência somente leitura (join com CarrinhoTurno: dia da semana × turno) — esta
/// lista não é editável por este endpoint; a associação é feita pelo slice
/// GerenciarTurnosDoCarrinho.
/// </summary>
public record CarrinhoResponse(
    int Id, string Nome, string? Descricao, bool Ativo, List<DisponibilidadeResponse> Disponibilidades);

public record DisponibilidadeResponse(DiaSemana DiaSemana, int TurnoId);
