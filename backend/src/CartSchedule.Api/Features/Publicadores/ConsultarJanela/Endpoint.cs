using CartSchedule.Api.Infrastructure;
using CartSchedule.Api.Shared;

namespace CartSchedule.Api.Features.Publicadores.ConsultarJanela;

/// <summary>
/// GET /api/janela — consulta se a janela de envio do publicador está aberta e qual é
/// o mês-alvo, calculado em tempo real a partir da data do servidor e de o administrador
/// ter fechado o envio. Sem autenticação (PLANNING.md §4, TASKS.md F1-BE-01, F15-BE-02).
/// </summary>
public static class Endpoint
{
    public static IEndpointRouteBuilder MapConsultarJanela(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/janela", async (AppDbContext db, TimeProvider relogio, CancellationToken ct) =>
        {
            var status = await JanelaDeEnvio.CalcularParaHojeAsync(db, relogio, ct);

            return Results.Ok(new JanelaResponse(status.Aberta, status.MesAlvo));
        });

        return app;
    }
}
