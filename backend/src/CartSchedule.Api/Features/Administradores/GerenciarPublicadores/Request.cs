namespace CartSchedule.Api.Features.Administradores.GerenciarPublicadores;

/// <summary>Cria um publicador com conta; o PIN é gerado pelo sistema.</summary>
public record CriarPublicadorRequest(string Nome, string Usuario, bool CriancaOuIdoso, bool Administrador);

/// <summary>
/// Edição parcial: campo ausente (null) não muda. Dar <see cref="Usuario"/> a um registro que
/// ainda não tem PIN cria as credenciais (o PIN gerado volta na resposta).
/// </summary>
public record EditarPublicadorRequest(
    string? Nome = null,
    string? Usuario = null,
    bool? CriancaOuIdoso = null,
    bool? Administrador = null);
