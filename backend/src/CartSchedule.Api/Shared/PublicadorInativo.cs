namespace CartSchedule.Api.Shared;

/// <summary>
/// Publicador desativado pelo administrador (issue #46): não entra no login e, enquanto as rotas
/// do publicador ainda usam o token anônimo do aparelho, também não pede, exclui nem renomeia.
/// O histórico continua legível e os pedidos já feitos continuam na escala.
/// </summary>
public static class PublicadorInativo
{
    public const string Codigo = "PUBLICADOR_INATIVO";

    public static IResult Problema() =>
        Results.Problem(
            title: "Seu acesso está desativado. Fale com o administrador.",
            statusCode: StatusCodes.Status403Forbidden,
            extensions: new Dictionary<string, object?> { ["codigo"] = Codigo });
}
