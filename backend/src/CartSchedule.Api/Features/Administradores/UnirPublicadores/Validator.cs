using FluentValidation;

namespace CartSchedule.Api.Features.Administradores.UnirPublicadores;

/// <summary>
/// Formato da lista de origens. O que depende da rota (o destino entre as origens) ou do login
/// (a própria conta) fica no endpoint.
/// </summary>
public class Validator : AbstractValidator<UnirPublicadoresRequest>
{
    public Validator()
    {
        RuleFor(r => r.OrigemIds)
            .NotEmpty()
            .WithMessage("Escolha ao menos um registro para unir.")
            .Must(ids => ids is null || ids.Distinct().Count() == ids.Count)
            .WithMessage("O mesmo registro foi escolhido mais de uma vez.");
    }
}
