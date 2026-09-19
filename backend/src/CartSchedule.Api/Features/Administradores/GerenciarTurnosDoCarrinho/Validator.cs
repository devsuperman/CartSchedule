using FluentValidation;

namespace CartSchedule.Api.Features.Administradores.GerenciarTurnosDoCarrinho;

/// <summary>
/// Validação de forma do request (lista não nula). A checagem de que cada id
/// pertence ao conjunto fixo de 6 turnos (regra de negócio, 400 se inválido)
/// e a existência do carrinho (404) são feitas no handler (Endpoint.cs).
/// </summary>
public class AtualizarTurnosDoCarrinhoRequestValidator : AbstractValidator<AtualizarTurnosDoCarrinhoRequest>
{
    public AtualizarTurnosDoCarrinhoRequestValidator()
    {
        RuleFor(r => r.TurnoIds)
            .NotNull()
            .WithMessage("TurnoIds é obrigatório.");
    }
}
