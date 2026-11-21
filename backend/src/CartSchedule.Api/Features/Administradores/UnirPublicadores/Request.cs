namespace CartSchedule.Api.Features.Administradores.UnirPublicadores;

/// <summary>Os registros (origens) que serão unidos ao registro que fica (o destino da rota).</summary>
public record UnirPublicadoresRequest(List<Guid>? OrigemIds);
