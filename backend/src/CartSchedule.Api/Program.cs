using CartSchedule.Api.Features.Administradores.GerenciarCarrinhos;
using CartSchedule.Api.Features.Administradores.GerenciarTurnosDoCarrinho;
using CartSchedule.Api.Features.Administradores.Login;
using CartSchedule.Api.Features.Administradores.ObterEscalaFinal;
using CartSchedule.Api.Features.Administradores.RevisarEscala.AdicionarSolicitacaoManual;
using CartSchedule.Api.Features.Administradores.RevisarEscala.AprovarSolicitacao;
using CartSchedule.Api.Features.Administradores.RevisarEscala.ListarSolicitacoesAgrupadas;
using CartSchedule.Api.Features.Administradores.RevisarEscala.RejeitarSolicitacao;
using CartSchedule.Api.Features.Publicadores.CancelarSolicitacao;
using CartSchedule.Api.Features.Publicadores.ConsultarJanela;
using CartSchedule.Api.Features.Publicadores.CriarSolicitacao;
using CartSchedule.Api.Features.Publicadores.ListarCarrinhosDisponiveis;
using CartSchedule.Api.Features.Publicadores.ListarHistorico;
using CartSchedule.Api.Infrastructure;
using CartSchedule.Api.Infrastructure.Auth;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

const string FrontendCorsPolicy = "FrontendCorsPolicy";

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Default")));

builder.Services.AddValidatorsFromAssemblyContaining<Program>();

builder.Services.AddProblemDetails();

builder.Services.AddAdminAuthentication(builder.Configuration);

builder.Services.AddCors(options =>
{
    options.AddPolicy(FrontendCorsPolicy, policy =>
    {
        var frontendOrigin = builder.Configuration["Cors:FrontendOrigin"] ?? "http://localhost:3000";

        policy.WithOrigins(frontendOrigin)
            .AllowAnyMethod()
            .WithHeaders("Content-Type", "X-Publicador-Token", "Authorization");
    });
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
}

app.UseCors(FrontendCorsPolicy);

app.UseExceptionHandler();
app.UseStatusCodePages();

app.UseAdminAuth();

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

// Publicadores (rotas públicas, sem autenticação)
app.MapConsultarJanela();
app.MapListarCarrinhosDisponiveis();
app.MapCriarSolicitacao();
app.MapListarHistorico();
app.MapCancelarSolicitacao();

// Administradores (rotas protegidas por JWT, exceto o login)
app.MapLogin();
app.MapGerenciarCarrinhos();
app.MapGerenciarTurnosDoCarrinho();
app.MapListarSolicitacoesAgrupadas();
app.MapAprovarSolicitacao();
app.MapRejeitarSolicitacao();
app.MapAdicionarSolicitacaoManual();
app.MapObterEscalaFinal();

app.Run();
