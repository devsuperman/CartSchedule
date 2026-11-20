namespace CartSchedule.Api.Features.Publicadores.ObterEu;

public record Response(Guid Id, string Nome, string? Usuario, bool Administrador);
