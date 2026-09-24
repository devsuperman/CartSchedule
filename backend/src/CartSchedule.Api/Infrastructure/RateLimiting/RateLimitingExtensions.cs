using System.Threading.RateLimiting;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;

namespace CartSchedule.Api.Infrastructure.RateLimiting;

/// <summary>
/// Limites de requisições por IP (seção de configuração "RateLimit"). As rotas do
/// publicador são públicas por decisão de produto (PLANNING.md regra 5), então a
/// proteção contra bots/flood e contra força bruta no login do admin é feita aqui,
/// sem atrito para quem usa o sistema normalmente. Os padrões são generosos porque
/// muitos publicadores podem sair pelo mesmo IP (Wi-Fi do salão, CGNAT do celular).
/// </summary>
public class RateLimitOptions
{
    public const string SectionName = "RateLimit";

    /// <summary>Teto geral por IP para qualquer rota /api.</summary>
    public int GlobalPorMinuto { get; set; } = 300;

    /// <summary>Criar/excluir solicitação (POST/DELETE /api/solicitacoes) por IP.</summary>
    public int EscritaPublicadorPorMinuto { get; set; } = 30;

    /// <summary>Tentativas de login do admin por IP numa janela de 15 minutos.</summary>
    public int LoginPor15Minutos { get; set; } = 5;
}

/// <summary>
/// Wiring do rate limiting. Program.cs chama <see cref="AddRateLimiting"/> no registro
/// de serviços e <see cref="UseRateLimiting"/> no pipeline; cada slice aplica a própria
/// política com <c>.RequireRateLimiting(RateLimitingExtensions.PoliticaX)</c>.
/// </summary>
public static class RateLimitingExtensions
{
    public const string PoliticaLogin = "login";
    public const string PoliticaEscritaPublicador = "publicador-escrita";

    /// <summary>
    /// Valor da extensão "codigo" do ProblemDetails de um 429 — o frontend decide por ele.
    /// </summary>
    public const string CodigoMuitasRequisicoes = "MUITAS_REQUISICOES";

    public static IServiceCollection AddRateLimiting(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<RateLimitOptions>(configuration.GetSection(RateLimitOptions.SectionName));

        // Em produção a cadeia é Caddy → nginx → API: sem isso o IP visto pela API seria
        // sempre o do nginx e todos os usuários dividiriam a mesma cota. A API só é
        // alcançável pela rede interna do compose, e o Caddy descarta X-Forwarded-For
        // vindo da internet, então o cliente não consegue forjar o próprio IP.
        services.Configure<ForwardedHeadersOptions>(options =>
        {
            options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
            options.ForwardLimit = 2;
            options.KnownIPNetworks.Clear();
            options.KnownProxies.Clear();
        });

        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.OnRejected = ResponderMuitasRequisicoesAsync;

            options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(httpContext =>
            {
                if (!httpContext.Request.Path.StartsWithSegments("/api"))
                {
                    return RateLimitPartition.GetNoLimiter(string.Empty);
                }

                var limite = Opcoes(httpContext).GlobalPorMinuto;
                return RateLimitPartition.GetFixedWindowLimiter(IpDoCliente(httpContext), _ => JanelaFixa(limite, TimeSpan.FromMinutes(1)));
            });

            options.AddPolicy(PoliticaEscritaPublicador, httpContext =>
            {
                var limite = Opcoes(httpContext).EscritaPublicadorPorMinuto;
                return RateLimitPartition.GetFixedWindowLimiter(IpDoCliente(httpContext), _ => JanelaFixa(limite, TimeSpan.FromMinutes(1)));
            });

            options.AddPolicy(PoliticaLogin, httpContext =>
            {
                var limite = Opcoes(httpContext).LoginPor15Minutos;
                return RateLimitPartition.GetFixedWindowLimiter(IpDoCliente(httpContext), _ => JanelaFixa(limite, TimeSpan.FromMinutes(15)));
            });
        });

        return services;
    }

    /// <summary>Primeiro middleware do pipeline: tudo que vem depois (inclusive o rate limiting) enxerga o IP real.</summary>
    public static WebApplication UseForwardedHeadersDoProxy(this WebApplication app)
    {
        app.UseForwardedHeaders();
        return app;
    }

    public static WebApplication UseRateLimiting(this WebApplication app)
    {
        app.UseRateLimiter();
        return app;
    }

    private static RateLimitOptions Opcoes(HttpContext httpContext) =>
        httpContext.RequestServices.GetRequiredService<IOptions<RateLimitOptions>>().Value;

    private static string IpDoCliente(HttpContext httpContext) =>
        httpContext.Connection.RemoteIpAddress?.ToString() ?? "desconhecido";

    private static FixedWindowRateLimiterOptions JanelaFixa(int limite, TimeSpan janela) => new()
    {
        PermitLimit = limite,
        Window = janela,
        QueueLimit = 0,
        AutoReplenishment = true,
    };

    private static async ValueTask ResponderMuitasRequisicoesAsync(OnRejectedContext context, CancellationToken ct)
    {
        var httpContext = context.HttpContext;

        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
        {
            httpContext.Response.Headers.RetryAfter = ((int)Math.Ceiling(retryAfter.TotalSeconds)).ToString();
        }

        httpContext.RequestServices.GetRequiredService<ILoggerFactory>()
            .CreateLogger(nameof(RateLimitingExtensions))
            .LogWarning(
                "Rate limit atingido: {Ip} {Metodo} {Caminho}",
                IpDoCliente(httpContext),
                httpContext.Request.Method,
                httpContext.Request.Path);

        await Results.Problem(
                title: "Muitas tentativas. Aguarde um pouco e tente novamente.",
                statusCode: StatusCodes.Status429TooManyRequests,
                extensions: new Dictionary<string, object?> { ["codigo"] = CodigoMuitasRequisicoes })
            .ExecuteAsync(httpContext);
    }
}
