using System.Globalization;
using CartSchedule.Api.Infrastructure;
using CartSchedule.Api.Shared;

namespace CartSchedule.Api.Features.Administradores.AlterarEnvioEscala;

/// <summary>
/// PUT /api/admin/escalas/{mes}/envio — o administrador fecha (ou reabre) o envio de pedidos
/// dos publicadores (PLANNING.md §4, TASKS.md F15-BE-03). A abertura é automática no dia 15;
/// o fechamento é só este. Vale apenas para a escala em envio (o mês-alvo de hoje): as outras
/// já não recebem pedidos dos publicadores de qualquer forma. Idempotente; cria a escala se
/// ela ainda não existe (fechar antes do primeiro pedido).
/// </summary>
public static class Endpoint
{
    public static IEndpointRouteBuilder MapAlterarEnvioEscala(this IEndpointRouteBuilder app)
    {
        app.MapPut("/api/admin/escalas/{mes}/envio", HandleAsync)
            .AddEndpointFilter<ValidationFilter<Request>>()
            .RequireAuthorization();

        return app;
    }

    private static async Task<IResult> HandleAsync(
        string mes, Request request, AppDbContext db, TimeProvider relogio, CancellationToken ct)
    {
        if (!DateOnly.TryParseExact(mes, "yyyy-MM", CultureInfo.InvariantCulture, DateTimeStyles.None, out var mesReferencia))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["mes"] = ["Formato inválido. Use yyyy-MM (ex: 2026-10)."],
            });
        }

        var mesAlvo = JanelaDeEnvio.MesAlvo(JanelaDeEnvio.Hoje(relogio));
        if (new DateOnly(mesReferencia.Year, mesReferencia.Month, 1) != mesAlvo)
        {
            return Results.Problem(
                title: "Escala fora do envio",
                detail: $"Só a escala em envio ({mesAlvo:MM/yyyy}) pode ter o envio fechado ou reaberto.",
                statusCode: StatusCodes.Status400BadRequest);
        }

        var escala = await EscalaHelpers.ObterOuCriarAsync(db, mesAlvo, ct);
        escala.EnvioFechado = !request.Aberto!.Value;
        await db.SaveChangesAsync(ct);

        return Results.NoContent();
    }
}
