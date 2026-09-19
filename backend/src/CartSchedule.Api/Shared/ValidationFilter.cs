using FluentValidation;

namespace CartSchedule.Api.Shared;

/// <summary>
/// Endpoint filter genérico: valida o TRequest do endpoint com o IValidator&lt;TRequest&gt;
/// registrado via FluentValidation (auto-descoberto por AddValidatorsFromAssemblyContaining
/// em Program.cs) e retorna 400 (ProblemDetails) se inválido. Uso em cada slice:
/// `.AddEndpointFilter&lt;ValidationFilter&lt;MinhaRequest&gt;&gt;()`.
/// </summary>
public class ValidationFilter<TRequest> : IEndpointFilter
    where TRequest : class
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var request = context.Arguments.OfType<TRequest>().FirstOrDefault();
        if (request is null)
        {
            return await next(context);
        }

        var validator = context.HttpContext.RequestServices.GetService<IValidator<TRequest>>();
        if (validator is null)
        {
            return await next(context);
        }

        var validationResult = await validator.ValidateAsync(request);
        if (!validationResult.IsValid)
        {
            return Results.ValidationProblem(validationResult.ToDictionary());
        }

        return await next(context);
    }
}
