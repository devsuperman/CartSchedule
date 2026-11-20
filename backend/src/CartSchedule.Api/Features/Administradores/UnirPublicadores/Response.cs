namespace CartSchedule.Api.Features.Administradores.UnirPublicadores;

/// <summary>
/// Pedidos da origem que passam ao destino e os que são descartados por o destino já ter a
/// mesma vaga na mesma escala (duplicidade, PLANNING.md regra 4).
/// </summary>
public record UnirPublicadoresResponse(int PedidosMovidos, int PedidosDescartados);
