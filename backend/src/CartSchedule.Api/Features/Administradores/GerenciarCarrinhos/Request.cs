namespace CartSchedule.Api.Features.Administradores.GerenciarCarrinhos;

/// <summary>
/// Request de criação de um novo carrinho. Nasce sempre com Ativo = true e sem turnos
/// associados (a associação de turnos é responsabilidade do slice GerenciarTurnosDoCarrinho).
/// DataEspecial preenchida cria um carrinho de um dia só (PLANNING.md regra 10a).
/// </summary>
public record CriarCarrinhoRequest(string Nome, string? Descricao, DateOnly? DataEspecial = null);

/// <summary>
/// Request de atualização (edição) de um carrinho existente: nome, descrição, ativo e data
/// especial. Descricao nula ou em branco apaga a descrição; DataEspecial nula volta a ser um
/// carrinho normal. Ao mudar a data de dia da semana, os turnos dos outros dias são removidos
/// (pedidos existentes nunca são tocados — regra 10).
/// </summary>
public record AtualizarCarrinhoRequest(string Nome, string? Descricao, bool Ativo, DateOnly? DataEspecial = null);
