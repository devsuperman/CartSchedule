namespace CartSchedule.Api.Features.Administradores.ExcluirPublicador;

/// <summary>Prévia da exclusão: quantos pedidos da pessoa serão excluídos e em quantas escalas.</summary>
public record ExcluirPublicadorPreviaResponse(int Pedidos, int Escalas);
