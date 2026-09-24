namespace CartSchedule.Api.Tests.Infraestrutura;

/// <summary>
/// Relógio fixo que o teste ajusta livremente (inclusive para trás, o que o
/// FakeTimeProvider não permite) — usado para abrir/fechar a janela de envio.
/// </summary>
public sealed class RelogioDeTeste(DateTimeOffset agora) : TimeProvider
{
    public DateTimeOffset Agora { get; set; } = agora;

    public override DateTimeOffset GetUtcNow() => Agora;
}
