namespace CartSchedule.Api.Features.Publicadores.ListarCarrinhosDisponiveis;

/// <summary>
/// Só os ids dos turnos habilitados — o frontend já tem os dados de exibição
/// dos 6 turnos fixos localmente (constants/turnos.ts) e faz o join por id
/// (TECHNICAL_SPEC.md §2.4), evitando uma segunda chamada à API.
/// </summary>
public record CarrinhoDisponivelResponse(int Id, string Nome, List<int> TurnoIds);
