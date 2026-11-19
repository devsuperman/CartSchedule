using FluentValidation;

namespace CartSchedule.Api.Features.Autenticacao.Login;

public class LoginRequestValidator : AbstractValidator<LoginRequest>
{
    public LoginRequestValidator()
    {
        RuleFor(x => x.Usuario).NotEmpty();
        RuleFor(x => x.Pin).NotEmpty();
    }
}
