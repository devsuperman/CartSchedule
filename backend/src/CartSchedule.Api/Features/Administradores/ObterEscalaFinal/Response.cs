using CartSchedule.Api.Domain.Enums;

namespace CartSchedule.Api.Features.Administradores.ObterEscalaFinal;

/// <summary>
/// Grade final do mês, calculada sob demanda a partir de todas as Solicitacao da escala
/// (toda solicitação existente conta) — não existe tabela própria de "escala final" (PLANNING.md §9, regra 5).
/// </summary>
public record EscalaFinalResponse(string Mes, List<EscalaFinalCelulaResponse> Celulas);

/// <summary>
/// Uma célula da grade Carrinho × Dia × Turno com pelo menos 1 publicador. Células vazias
/// nunca aparecem aqui (não enumeramos a matriz completa).
/// </summary>
public record EscalaFinalCelulaResponse(
    int CarrinhoId,
    string CarrinhoNome,
    DiaSemana DiaSemana,
    int TurnoId,
    List<PublicadorNaEscalaResponse> Publicadores);

public record PublicadorNaEscalaResponse(Guid PublicadorId, string PublicadorNome);
