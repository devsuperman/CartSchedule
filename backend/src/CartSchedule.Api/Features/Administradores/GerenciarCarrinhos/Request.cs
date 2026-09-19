namespace CartSchedule.Api.Features.Administradores.GerenciarCarrinhos;

/// <summary>
/// Request de criação de um novo carrinho. Nasce sempre com Ativo = true e sem turnos
/// associados (a associação de turnos é responsabilidade do slice GerenciarTurnosDoCarrinho).
/// </summary>
public record CriarCarrinhoRequest(string Nome);

/// <summary>
/// Request de atualização de um carrinho existente (nome e ativo). Não altera turnos.
/// </summary>
public record AtualizarCarrinhoRequest(string Nome, bool Ativo);
