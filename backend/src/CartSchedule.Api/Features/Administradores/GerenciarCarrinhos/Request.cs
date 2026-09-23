namespace CartSchedule.Api.Features.Administradores.GerenciarCarrinhos;

/// <summary>
/// Request de criação de um novo carrinho. Nasce sempre com Ativo = true e sem turnos
/// associados (a associação de turnos é responsabilidade do slice GerenciarTurnosDoCarrinho).
/// </summary>
public record CriarCarrinhoRequest(string Nome, string? Descricao);

/// <summary>
/// Request de atualização (edição) de um carrinho existente: nome, descrição e ativo.
/// Descricao nula ou em branco apaga a descrição. Não altera turnos.
/// </summary>
public record AtualizarCarrinhoRequest(string Nome, string? Descricao, bool Ativo);
