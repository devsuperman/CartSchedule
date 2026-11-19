namespace CartSchedule.Api.Features.Administradores.GerenciarPublicadores;

/// <summary>Item da lista; o PIN nunca é exposto, só se a conta já tem um.</summary>
public record PublicadorResponse(
    Guid Id,
    string Nome,
    string? Usuario,
    bool CriancaOuIdoso,
    bool Administrador,
    bool Ativo,
    bool TemPin);

/// <summary>PIN em claro: só nesta resposta (criação, criação das credenciais ou redefinição), nunca mais.</summary>
public record CredenciaisResponse(Guid Id, string Usuario, string Pin);
