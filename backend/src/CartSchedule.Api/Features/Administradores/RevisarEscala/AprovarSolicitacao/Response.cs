using CartSchedule.Api.Domain.Enums;

namespace CartSchedule.Api.Features.Administradores.RevisarEscala.AprovarSolicitacao;

public record SolicitacaoDecisaoResponse(int Id, StatusSolicitacao Status);
