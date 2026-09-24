using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Testcontainers.PostgreSql;

namespace CartSchedule.Api.Tests.Infraestrutura;

/// <summary>
/// Sobe um PostgreSQL real (Testcontainers) e a API inteira em memória
/// (WebApplicationFactory) uma única vez para todos os testes da coleção "api". As
/// migrations rodam no startup da API, como em produção. O relógio é um
/// RelogioDeTeste para os testes controlarem a janela de envio (dias 15–25).
/// </summary>
public sealed class ApiFixture : IAsyncLifetime
{
    public const string AdminUsuario = "admin";
    public const string AdminSenha = "senha-de-teste";

    /// <summary>Dia 20/09/2026 ao meio-dia de Brasília: janela aberta, mês-alvo = outubro/2026.</summary>
    public static readonly DateTimeOffset DataComJanelaAberta = new(2026, 9, 20, 15, 0, 0, TimeSpan.Zero);

    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:16-alpine").Build();

    public RelogioDeTeste Relogio { get; } = new(DataComJanelaAberta);

    public WebApplicationFactory<Program> Factory { get; private set; } = null!;

    public async ValueTask InitializeAsync()
    {
        await _postgres.StartAsync();

        var senhaHash = new PasswordHasher<object>().HashPassword(new object(), AdminSenha);

        Factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseSetting("ConnectionStrings:Default", _postgres.GetConnectionString());
            builder.UseSetting("Admin:Usuario", AdminUsuario);
            builder.UseSetting("Admin:SenhaHash", senhaHash);
            builder.UseSetting("Jwt:ChaveSecreta", "chave-secreta-de-teste-com-32-bytes!!");
            // Todos os testes dividem o mesmo "IP" e o mesmo host: limites altos para a suíte
            // não esbarrar no rate limiting (RateLimitingTests sobe um host próprio com limites baixos).
            builder.UseSetting("RateLimit:GlobalPorMinuto", "100000");
            builder.UseSetting("RateLimit:EscritaPublicadorPorMinuto", "100000");
            builder.UseSetting("RateLimit:LoginPor15Minutos", "100000");
            builder.UseSetting("Logging:LogLevel:Default", "Warning");
            // Numa base nova o EF loga como erro a consulta ao histórico de migrations, que ainda não existe.
            builder.UseSetting("Logging:LogLevel:Microsoft.EntityFrameworkCore.Database.Command", "None");
            builder.ConfigureTestServices(services => services.AddSingleton<TimeProvider>(Relogio));
        });

        // Força o startup (migrations + seed dos turnos) antes do primeiro teste.
        Factory.CreateClient().Dispose();
    }

    /// <summary>Apaga todos os dados, menos os 6 turnos fixos (seed), e volta o relógio para a janela aberta.</summary>
    public async Task LimparAsync()
    {
        await using var conexao = new NpgsqlConnection(_postgres.GetConnectionString());
        await conexao.OpenAsync();
        await using var comando = new NpgsqlCommand(
            "TRUNCATE solicitacoes, carrinho_turnos, carrinhos, escalas, publicadores RESTART IDENTITY CASCADE;",
            conexao);
        await comando.ExecuteNonQueryAsync();

        Relogio.Agora = DataComJanelaAberta;
    }

    public async ValueTask DisposeAsync()
    {
        await Factory.DisposeAsync();
        await _postgres.DisposeAsync();
    }
}

[CollectionDefinition("api")]
public sealed class ApiCollection : ICollectionFixture<ApiFixture>;
