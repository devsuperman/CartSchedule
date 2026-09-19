namespace CartSchedule.Api.Features.Administradores.GerenciarCarrinhos;

/// <summary>
/// Representação de um carrinho para o painel do administrador. TurnoIds é um campo de
/// conveniência somente leitura (join com CarrinhoTurno) — esta lista não é editável por
/// este endpoint; a associação de turnos é feita pelo slice GerenciarTurnosDoCarrinho.
/// </summary>
public record CarrinhoResponse(int Id, string Nome, bool Ativo, List<int> TurnoIds);
