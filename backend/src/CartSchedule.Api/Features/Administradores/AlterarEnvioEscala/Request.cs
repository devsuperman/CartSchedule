namespace CartSchedule.Api.Features.Administradores.AlterarEnvioEscala;

/// <summary>
/// <see cref="Aberto"/>: false fecha o envio dos publicadores; true reabre. Obrigatório — um
/// corpo sem o campo não pode fechar o envio por engano.
/// </summary>
public record Request(bool? Aberto);
