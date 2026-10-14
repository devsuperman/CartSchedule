namespace CartSchedule.Api.Shared;

/// <summary>
/// Lotação de uma vaga (carrinho, dia, turno) para o publicador (PLANNING.md regras 3 e 4):
/// só o envio do publicador é barrado quando a vaga está cheia. O administrador (adicionar,
/// mover) nunca é bloqueado e pode completar o 3º (criança/idoso) ou exceder.
/// </summary>
public static class LotacaoDaVaga
{
    /// <summary>Valor da extensão "codigo" do ProblemDetails quando a vaga já está cheia.</summary>
    public const string CodigoVagaCheia = "VAGA_CHEIA";

    /// <summary>Pessoas a partir das quais a vaga é cheia para o publicador (CriancaOuIdoso só o admin marca).</summary>
    public const int LimiteParaPublicador = 2;
}
