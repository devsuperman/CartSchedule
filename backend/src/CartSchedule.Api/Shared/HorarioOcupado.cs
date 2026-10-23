using System.Linq.Expressions;
using CartSchedule.Api.Domain;
using CartSchedule.Api.Domain.Enums;

namespace CartSchedule.Api.Shared;

/// <summary>
/// Um publicador não pode estar em dois lugares ao mesmo tempo (PLANNING.md regra 10): no envio,
/// ele não pode pedir um (dia da semana, turno) em que já tem pedido na escala, em qualquer
/// carrinho. Só o publicador é barrado; o administrador (adicionar, mover) é apenas avisado.
/// Carrinhos de data especial (regra 10a) formam um grupo à parte: só conflitam com outros
/// carrinhos especiais da mesma data, nunca com a escala semanal.
/// </summary>
public static class HorarioOcupado
{
    /// <summary>Valor da extensão "codigo" do ProblemDetails quando o publicador já tem pedido no horário.</summary>
    public const string Codigo = "HORARIO_OCUPADO";

    /// <summary>
    /// Pedidos do publicador que ocupam o (dia, turno) no grupo de <paramref name="dataEspecial"/>
    /// (null = carrinhos normais). Usa o grupo gravado em cada pedido, não o do carrinho atual.
    /// </summary>
    public static Expression<Func<Solicitacao, bool>> NoHorario(
        Guid publicadorId, int escalaId, DiaSemana diaSemana, int turnoId, DateOnly? dataEspecial) =>
        s => s.PublicadorId == publicadorId
            && s.EscalaId == escalaId
            && s.DiaSemana == diaSemana
            && s.TurnoId == turnoId
            && s.DataEspecial == dataEspecial;
}
