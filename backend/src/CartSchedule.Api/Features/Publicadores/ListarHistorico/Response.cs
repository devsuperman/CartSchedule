namespace CartSchedule.Api.Features.Publicadores.ListarHistorico;

public record ListarHistoricoResponse(
    int Id,
    DateOnly EscalaMesReferencia,
    int CarrinhoId,
    string CarrinhoNome,
    int DiaSemana,
    int TurnoId,
    int Status,
    int Origem);
