namespace CartSchedule.Api.Features.Administradores.RevisarEscala.ListarSolicitacoesAgrupadas;

public record ListarSolicitacoesAgrupadasResponse(string Mes, List<GrupoResponse> Grupos);

public record GrupoResponse(
    int CarrinhoId,
    string CarrinhoNome,
    int DiaSemana,
    int TurnoId,
    bool Excedente,
    List<SolicitacaoAgrupadaResponse> Solicitacoes);

public record SolicitacaoAgrupadaResponse(
    int Id,
    Guid PublicadorId,
    string PublicadorNome,
    int Status,
    int Origem,
    DateTimeOffset CriadoEm,
    int TotalNaEscala);
