using CartSchedule.Api.Domain.Enums;

namespace CartSchedule.Api.Features.Publicadores.ListarCarrinhosDisponiveis;

/// <summary>
/// Só os pares (dia da semana, id do turno) habilitados — o frontend já tem os dados de
/// exibição dos 6 turnos fixos localmente (constants/turnos.ts) e faz o join por id
/// (TECHNICAL_SPEC.md §2.4), evitando uma segunda chamada à API. `DataEspecial` preenchida =
/// carrinho de um dia só (regra 10a), que não ocupa o horário da escala semanal.
/// </summary>
public record CarrinhoDisponivelResponse(
    int Id, string Nome, string? Descricao, DateOnly? DataEspecial, List<DisponibilidadeResponse> Disponibilidades);

/// <summary>
/// `Ocupacao` = pessoas já na vaga na escala-alvo; `Cheia` = o publicador não pode mais pedi-la
/// (o admin continua podendo adicionar/mover para lá).
/// </summary>
public record DisponibilidadeResponse(DiaSemana DiaSemana, int TurnoId, int Ocupacao, bool Cheia);
