using FluentValidation;

namespace CartSchedule.Api.Features.Administradores.AlterarEnvioEscala;

public class Validator : AbstractValidator<Request>
{
    public Validator()
    {
        RuleFor(r => r.Aberto)
            .NotNull();
    }
}
