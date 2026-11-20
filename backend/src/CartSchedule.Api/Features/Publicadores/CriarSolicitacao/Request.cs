using CartSchedule.Api.Domain.Enums;

namespace CartSchedule.Api.Features.Publicadores.CriarSolicitacao;

public record Request(int CarrinhoId, DiaSemana DiaSemana, int TurnoId);
