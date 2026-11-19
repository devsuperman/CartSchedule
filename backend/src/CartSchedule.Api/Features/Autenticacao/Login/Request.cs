namespace CartSchedule.Api.Features.Autenticacao.Login;

/// <summary>
/// <see cref="Pin"/> é o PIN de 4 dígitos do publicador — ou a senha do administrador de
/// recuperação, que não precisa ter 4 dígitos.
/// </summary>
public record LoginRequest(string Usuario, string Pin);
