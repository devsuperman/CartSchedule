namespace CartSchedule.Api.Features.Administradores.GerenciarPublicadores;

/// <summary>
/// Item da lista; o PIN nunca é exposto, só se a conta já tem um. <see cref="EhVoce"/> marca o
/// administrador logado (a tela não oferece excluir nem tirar o próprio administrador).
/// </summary>
public record PublicadorResponse(
    Guid Id,
    string Nome,
    string? Usuario,
    bool CriancaOuIdoso,
    bool Administrador,
    bool TemPin,
    bool EhVoce);

/// <summary>PIN em claro: só nesta resposta (criação, criação das credenciais ou redefinição), nunca mais.</summary>
public record CredenciaisResponse(Guid Id, string Usuario, string Pin);
