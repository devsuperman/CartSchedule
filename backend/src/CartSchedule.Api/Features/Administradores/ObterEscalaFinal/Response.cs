using CartSchedule.Api.Domain.Enums;

namespace CartSchedule.Api.Features.Administradores.ObterEscalaFinal;

/// <summary>
/// Grade do mês, calculada sob demanda a partir das vagas configuradas e de todas as
/// Solicitacao da escala (toda solicitação existente conta) — não existe tabela própria de
/// "escala final" (PLANNING.md §9). É a tela onde o administrador gere a escala: move,
/// adiciona e exclui pedidos vendo onde há vaga.
/// </summary>
public record EscalaFinalResponse(string Mes, List<EscalaFinalCelulaResponse> Celulas);

/// <summary>
/// Uma célula da grade Carrinho × Dia × Turno. Aparecem todas as vagas configuradas dos
/// carrinhos ativos (mesmo vazias) e toda célula que tenha pedidos, ainda que o turno tenha
/// sido removido ou o carrinho desativado depois (regra 10) — nesse caso
/// <see cref="Disponivel"/> é false e a célula não recebe novos pedidos pela tela.
/// </summary>
public record EscalaFinalCelulaResponse(
    int CarrinhoId,
    string CarrinhoNome,
    DiaSemana DiaSemana,
    int TurnoId,
    bool Disponivel,
    List<PublicadorNaEscalaResponse> Publicadores);

/// <summary>
/// Um pedido na célula. <see cref="TotalNaEscala"/> é a contagem de apoio (regra 13): quantos
/// pedidos o publicador tem na escala inteira — só informação, nunca critério automático.
/// <see cref="CriancaOuIdoso"/> deixa o frontend aceitar uma 3ª pessoa na vaga sem sinalizar
/// excesso (regra 1); o backend não calcula limite.
/// </summary>
public record PublicadorNaEscalaResponse(
    int SolicitacaoId,
    Guid PublicadorId,
    string PublicadorNome,
    OrigemSolicitacao Origem,
    int TotalNaEscala,
    bool CriancaOuIdoso);
