using CartSchedule.Api.Features.Administradores.AlterarEnvioEscala;
using CartSchedule.Api.Features.Administradores.GerenciarCarrinhos;
using CartSchedule.Api.Features.Administradores.GerenciarTurnosDoCarrinho;
using CartSchedule.Api.Features.Administradores.MoverSolicitacao;
using CartSchedule.Api.Features.Administradores.ObterEscalaFinal;
using CartSchedule.Api.Features.Administradores.GerenciarPublicadores;
using CartSchedule.Api.Features.Administradores.RevisarEscala.AdicionarSolicitacaoManual;
using CartSchedule.Api.Features.Administradores.RevisarEscala.ExcluirSolicitacao;
using CartSchedule.Api.Features.Administradores.ExcluirPublicador;
using CartSchedule.Api.Features.Administradores.UnirPublicadores;
using CartSchedule.Api.Features.Autenticacao.Login;
using CartSchedule.Api.Features.Autenticacao.RenovarSessao;
using CartSchedule.Api.Features.Publicadores.ExcluirSolicitacao;
using CartSchedule.Api.Features.Publicadores.ObterEu;
using CartSchedule.Api.Features.Publicadores.TrocarPin;
using CartSchedule.Api.Features.Publicadores.ConsultarJanela;
using CartSchedule.Api.Features.Publicadores.CriarSolicitacao;
using CartSchedule.Api.Features.Publicadores.ListarCarrinhosDisponiveis;
using CartSchedule.Api.Features.Publicadores.ListarHistorico;
using CartSchedule.Api.Infrastructure;
using CartSchedule.Api.Infrastructure.Auth;
using CartSchedule.Api.Infrastructure.RateLimiting;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

const string FrontendCorsPolicy = "FrontendCorsPolicy";

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Default")));

builder.Services.AddValidatorsFromAssemblyContaining<Program>();

// Relógio injetável: a abertura da janela de envio depende da data (os testes fixam uma data).
builder.Services.AddSingleton(TimeProvider.System);

builder.Services.AddProblemDetails();

builder.Services.AddAdminAuthentication(builder.Configuration);

builder.Services.AddRateLimiting(builder.Configuration);

builder.Services.AddCors(options =>
{
    options.AddPolicy(FrontendCorsPolicy, policy =>
    {
        var frontendOrigin = builder.Configuration["Cors:FrontendOrigin"] ?? "http://localhost:3000";

        policy.WithOrigins(frontendOrigin)
            .AllowAnyMethod()
            .WithHeaders("Content-Type", "Authorization");
    });
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
}

app.UseForwardedHeadersDoProxy();

app.UseCors(FrontendCorsPolicy);

app.UseExceptionHandler();
app.UseStatusCodePages();

app.UseRateLimiting();

app.UseAdminAuth();

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

// Publicadores (login de publicador ou administrador; o publicador vem do token)
app.MapConsultarJanela();
app.MapListarCarrinhosDisponiveis();
app.MapCriarSolicitacao();
app.MapListarHistorico();
app.MapExcluirSolicitacao();
app.MapObterEu();
app.MapTrocarPin();

// Login único (administrador de recuperação e publicadores)
app.MapLogin();
app.MapRenovarSessao();

// Administradores (rotas protegidas por JWT: administrador ou recuperação)
app.MapGerenciarCarrinhos();
app.MapGerenciarTurnosDoCarrinho();
app.MapExcluirSolicitacaoAdmin();
app.MapAdicionarSolicitacaoManual();
app.MapObterEscalaFinal();
app.MapGerenciarPublicadores();
app.MapUnirPublicadores();
app.MapExcluirPublicador();
app.MapMoverSolicitacao();
app.MapAlterarEnvioEscala();

app.Run();
