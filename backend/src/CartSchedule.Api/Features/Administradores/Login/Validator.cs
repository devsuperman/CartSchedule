using FluentValidation;

namespace CartSchedule.Api.Features.Administradores.Login;

public class LoginRequestValidator : AbstractValidator<LoginRequest>
{
    public LoginRequestValidator()
    {
        RuleFor(x => x.Usuario).NotEmpty();
        RuleFor(x => x.Senha).NotEmpty();
    }
}
