using FluentValidation;

namespace CartSchedule.Api.Features.Administradores.GerenciarCarrinhos;

public class CriarCarrinhoRequestValidator : AbstractValidator<CriarCarrinhoRequest>
{
    public CriarCarrinhoRequestValidator()
    {
        RuleFor(r => r.Nome)
            .NotEmpty()
            .MaximumLength(200);
    }
}

public class AtualizarCarrinhoRequestValidator : AbstractValidator<AtualizarCarrinhoRequest>
{
    public AtualizarCarrinhoRequestValidator()
    {
        RuleFor(r => r.Nome)
            .NotEmpty()
            .MaximumLength(200);
    }
}
