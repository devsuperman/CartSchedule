namespace CartSchedule.Api.Shared;

/// <summary>
/// Lotação de uma vaga `(carrinho, dia, turno)` para o PUBLICADOR (PLANNING.md regra 3):
/// com <see cref="Limite"/> solicitações a vaga está cheia e não aceita novos envios do
/// publicador. O administrador (adicionar/mover) nunca é bloqueado por isso.
/// </summary>
public static class LotacaoDaVaga
{
    public const int Limite = 2;

    /// <summary>Valor da extensão "codigo" do ProblemDetails quando a vaga já está cheia.</summary>
    public const string CodigoVagaCheia = "VAGA_CHEIA";
}
