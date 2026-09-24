using FluentValidation;

namespace CartSchedule.Api.Features.Administradores.RenomearPublicador;

public class Validator : AbstractValidator<Request>
{
    public Validator()
    {
        RuleFor(r => r.Nome)
            .NotEmpty()
            .MaximumLength(200);
    }
}
