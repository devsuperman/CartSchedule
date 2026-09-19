using CartSchedule.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

const string FrontendCorsPolicy = "FrontendCorsPolicy";

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Default")));

builder.Services.AddProblemDetails();

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

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

// Os grupos de rotas de cada slice (Features/Publicadores/*, Features/Administradores/*)
// são registrados aqui, um por tarefa (ver TASKS.md — manter o diff mínimo).

app.Run();
