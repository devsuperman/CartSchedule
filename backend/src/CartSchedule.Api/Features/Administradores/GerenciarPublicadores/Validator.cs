using FluentValidation;

namespace CartSchedule.Api.Features.Administradores.GerenciarPublicadores;

internal static class RegrasDoUsuario
{
    public const int TamanhoMaximo = 50;

    /// <summary>Uma palavra só (ex: "Maria", "MariaS"), sem espaços no meio.</summary>
    public static bool Valido(string? usuario)
    {
        var limpo = usuario?.Trim();
        return !string.IsNullOrEmpty(limpo) && limpo.Length <= TamanhoMaximo && !limpo.Any(char.IsWhiteSpace);
    }

    public const string Mensagem = "Usuário obrigatório, sem espaços, com até 50 caracteres.";
}

public class CriarPublicadorRequestValidator : AbstractValidator<CriarPublicadorRequest>
{
    public CriarPublicadorRequestValidator()
    {
        RuleFor(r => r.Nome).NotEmpty().MaximumLength(200);
        RuleFor(r => r.Usuario).Must(RegrasDoUsuario.Valido).WithMessage(RegrasDoUsuario.Mensagem);
    }
}

public class EditarPublicadorRequestValidator : AbstractValidator<EditarPublicadorRequest>
{
    public EditarPublicadorRequestValidator()
    {
        RuleFor(r => r.Nome).NotEmpty().MaximumLength(200).When(r => r.Nome is not null);
        RuleFor(r => r.Usuario).Must(RegrasDoUsuario.Valido).WithMessage(RegrasDoUsuario.Mensagem)
            .When(r => r.Usuario is not null);
    }
}
