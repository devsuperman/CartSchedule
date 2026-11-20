using CartSchedule.Api.Shared;
using FluentValidation;

namespace CartSchedule.Api.Features.Publicadores.TrocarPin;

public class TrocarPinRequestValidator : AbstractValidator<TrocarPinRequest>
{
    public TrocarPinRequestValidator()
    {
        RuleFor(r => r.PinAtual).NotEmpty();
        RuleFor(r => r.PinNovo).Must(Pin.TemFormatoValido).WithMessage(Pin.MensagemDeFormato);
    }
}
