using CartSchedule.Api.Domain.Enums;

namespace CartSchedule.Api.Features.Publicadores.CriarSolicitacao;

public record Response(
    int Id,
    int CarrinhoId,
    DiaSemana DiaSemana,
    int TurnoId,
    DateTimeOffset CriadoEm);
