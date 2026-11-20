using FluentValidation;

namespace CartSchedule.Api.Features.Publicadores.TrocarPin;

public class TrocarPinRequestValidator : AbstractValidator<TrocarPinRequest>
{
    public TrocarPinRequestValidator()
    {
        RuleFor(r => r.PinAtual).NotEmpty();
        // Só dígitos ASCII: o teclado numérico do celular e o login só usam 0–9.
        RuleFor(r => r.PinNovo).Matches("^[0-9]{4}$").WithMessage("O PIN novo precisa ter exatamente 4 dígitos.");
    }
}
