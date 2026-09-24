using FluentValidation;

namespace CartSchedule.Api.Features.Administradores.GerenciarTurnosDoCarrinho;

/// <summary>
/// Validação de forma do request (lista não nula, dia da semana Segunda–Sexta). A
/// checagem de que cada turno pertence ao conjunto fixo de 6 (regra de negócio, 400 se
/// inválido) e a existência do carrinho (404) são feitas no handler (Endpoint.cs).
/// </summary>
public class AtualizarTurnosDoCarrinhoRequestValidator : AbstractValidator<AtualizarTurnosDoCarrinhoRequest>
{
    public AtualizarTurnosDoCarrinhoRequestValidator()
    {
        RuleFor(r => r.Disponibilidades)
            .NotNull()
            .WithMessage("Disponibilidades é obrigatório.");

        RuleForEach(r => r.Disponibilidades)
            .ChildRules(d => d.RuleFor(x => x.DiaSemana).IsInEnum().WithMessage("Dia da semana inválido (Segunda a Sexta)."));
    }
}
