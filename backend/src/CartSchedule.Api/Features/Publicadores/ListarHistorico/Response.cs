namespace CartSchedule.Api.Features.Publicadores.ListarHistorico;

public record ListarHistoricoResponse(
    int Id,
    DateOnly EscalaMesReferencia,
    int CarrinhoId,
    string CarrinhoNome,
    string? CarrinhoDescricao,
    DateOnly? CarrinhoDataEspecial,
    int DiaSemana,
    int TurnoId,
    int Origem);
