using CartSchedule.Api.Domain.Enums;

namespace CartSchedule.Api.Features.Administradores.RevisarEscala.RejeitarSolicitacao;

public record SolicitacaoDecisaoResponse(int Id, StatusSolicitacao Status);
