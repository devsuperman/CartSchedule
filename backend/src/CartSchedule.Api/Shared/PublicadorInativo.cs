namespace CartSchedule.Api.Shared;

/// <summary>
/// Publicador desativado pelo administrador (issue #46): o login o recusa com este código e os
/// tokens que ele já tinha deixam de valer (401, <c>ValidacaoDaSessao</c>). Os pedidos já feitos
/// continuam na escala.
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
