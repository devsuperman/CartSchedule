namespace CartSchedule.Api.Shared;

/// <summary>
/// Um publicador não pode estar em dois lugares ao mesmo tempo (PLANNING.md regra 10): no envio,
/// ele não pode pedir um (dia da semana, turno) em que já tem pedido na escala, em qualquer
/// carrinho. Só o publicador é barrado; o administrador (adicionar, mover) é apenas avisado.
/// </summary>
public static class HorarioOcupado
{
    /// <summary>Valor da extensão "codigo" do ProblemDetails quando o publicador já tem pedido no horário.</summary>
    public const string Codigo = "HORARIO_OCUPADO";
}
