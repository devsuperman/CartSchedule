using CartSchedule.Api.Domain.Enums;

namespace CartSchedule.Api.Features.Administradores.RevisarEscala.AdicionarSolicitacaoManual;

/// <summary>
/// Corpo da adição manual de solicitação pelo administrador: um publicador já cadastrado
/// (ADR 0001). Nome livre não cria mais publicador — conta nova é criada antes, em
/// <c>POST /api/admin/publicadores</c>.
/// </summary>
public class Request
{
    public Guid PublicadorId { get; set; }

    public int CarrinhoId { get; set; }

    public DiaSemana DiaSemana { get; set; }

    public int TurnoId { get; set; }
}
