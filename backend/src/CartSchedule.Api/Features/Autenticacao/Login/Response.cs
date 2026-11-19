namespace CartSchedule.Api.Features.Autenticacao.Login;

/// <summary><see cref="Papel"/>: publicador, administrador ou recuperacao (<c>Papeis</c>).</summary>
public record LoginResponse(string Token, string Papel);
