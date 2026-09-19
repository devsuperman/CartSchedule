namespace CartSchedule.Api.Features.Publicadores.ConsultarJanela;

/// <summary>
/// Resposta de GET /api/janela — status da janela de envio calculado em tempo real
/// (PLANNING.md §4, TECHNICAL_SPEC.md §2.5).
/// </summary>
public record JanelaResponse(bool Aberta, DateOnly MesAlvo);
