using CartSchedule.Api.Domain.Enums;

namespace CartSchedule.Api.Features.Administradores.RevisarEscala.AdicionarSolicitacaoManual;

/// <summary>
/// Corpo da adição manual de solicitação pelo administrador. O publicador é identificado
/// por nome livre (PLANNING.md regra 9) — não há token nesse fluxo.
/// </summary>
public class Request
{
    public string Nome { get; set; } = string.Empty;

    public int CarrinhoId { get; set; }

    public DiaSemana DiaSemana { get; set; }

    public int TurnoId { get; set; }
}
