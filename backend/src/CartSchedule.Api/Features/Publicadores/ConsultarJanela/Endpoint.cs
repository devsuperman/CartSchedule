using CartSchedule.Api.Shared;

namespace CartSchedule.Api.Features.Publicadores.ConsultarJanela;

/// <summary>
/// GET /api/janela — consulta se a janela de envio do publicador está aberta e qual é
/// o mês-alvo, calculado em tempo real a partir da data do servidor. Sem autenticação
/// e sem acesso a banco (PLANNING.md §4, TASKS.md F1-BE-01).
/// </summary>
public static class Endpoint
{
    public static IEndpointRouteBuilder MapConsultarJanela(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/janela", () =>
        {
            var status = JanelaDeEnvio.CalcularParaHoje();

            return Results.Ok(new JanelaResponse(status.Aberta, status.MesAlvo));
        });

        return app;
    }
}
