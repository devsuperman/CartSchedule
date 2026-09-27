namespace CartSchedule.Api.Features.Administradores.RenomearPublicador;

/// <summary>
/// <see cref="CriancaOuIdoso"/> ausente (null) mantém a marca atual, para quem só corrige o nome.
/// </summary>
public record Request(string Nome, bool? CriancaOuIdoso = null);
