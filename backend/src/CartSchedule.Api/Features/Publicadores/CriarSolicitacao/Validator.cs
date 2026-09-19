using FluentValidation;

namespace CartSchedule.Api.Features.Publicadores.CriarSolicitacao;

public class Validator : AbstractValidator<Request>
{
    public Validator()
    {
        RuleFor(r => r.Nome)
            .NotEmpty()
            .MaximumLength(200);

        RuleFor(r => r.CarrinhoId)
            .GreaterThan(0);

        RuleFor(r => r.DiaSemana)
            .IsInEnum();

        RuleFor(r => r.TurnoId)
            .GreaterThan(0);
    }
}
