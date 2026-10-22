using CartSchedule.Api.Shared;
using FluentValidation;

namespace CartSchedule.Api.Features.Administradores.GerenciarCarrinhos;

public class CriarCarrinhoRequestValidator : AbstractValidator<CriarCarrinhoRequest>
{
    public CriarCarrinhoRequestValidator()
    {
        RuleFor(r => r.Nome)
            .NotEmpty()
            .MaximumLength(200);

        RuleFor(r => r.Descricao)
            .MaximumLength(500);

        RuleFor(r => r.DataEspecial)
            .Must(d => d is null || DataEspecial.DiaSemanaDe(d.Value) is not null)
            .WithMessage("A data especial precisa cair de Segunda a Sexta.");
    }
}

public class AtualizarCarrinhoRequestValidator : AbstractValidator<AtualizarCarrinhoRequest>
{
    public AtualizarCarrinhoRequestValidator()
    {
        RuleFor(r => r.Nome)
            .NotEmpty()
            .MaximumLength(200);

        RuleFor(r => r.Descricao)
            .MaximumLength(500);

        RuleFor(r => r.DataEspecial)
            .Must(d => d is null || DataEspecial.DiaSemanaDe(d.Value) is not null)
            .WithMessage("A data especial precisa cair de Segunda a Sexta.");
    }
}
