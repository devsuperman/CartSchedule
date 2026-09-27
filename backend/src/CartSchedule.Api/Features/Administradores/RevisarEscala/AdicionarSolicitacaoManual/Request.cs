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

    /// <summary>
    /// true marca a pessoa como criança ou idoso (PLANNING.md regra 1), seja ela nova ou
    /// reusada pelo nome; a adição nunca desmarca (isso é feito em "Editar pessoa").
    /// </summary>
    public bool? CriancaOuIdoso { get; set; }
}
