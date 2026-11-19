using CartSchedule.Api.Domain;
using CartSchedule.Api.Infrastructure;
using CartSchedule.Api.Shared;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace CartSchedule.Api.Features.Administradores.GerenciarPublicadores;

/// <summary>
/// Tela "Publicadores" (ADR 0001): o administrador lista/busca, cria contas (usuário + PIN
/// gerado) e edita nome, usuário, criança/idoso e administrador. Nome e marca criança/idoso
/// valem em todos os pedidos da pessoa. Nomes repetidos são permitidos; usuários não
/// (comparados sem maiúsculas e sem acentos → 409 USUARIO_EM_USO). Registros antigos, sem
/// usuário, recebem usuário pela edição e, junto, o PIN — mantendo id e histórico.
/// </summary>
public static class Endpoint
{
    public const string CodigoUsuarioEmUso = "USUARIO_EM_USO";

    public static IEndpointRouteBuilder MapGerenciarPublicadores(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/admin/publicadores").RequireAuthorization();

        group.MapGet("/", ListarAsync);

        group.MapPost("/", CriarAsync)
            .AddEndpointFilter<ValidationFilter<CriarPublicadorRequest>>();

        group.MapPut("/{id:guid}", EditarAsync)
            .AddEndpointFilter<ValidationFilter<EditarPublicadorRequest>>();

        return app;
    }

    private static async Task<IResult> ListarAsync(string? busca, AppDbContext db, CancellationToken ct)
    {
        // Poucas centenas de pessoas no máximo: a busca sem acentos é feita em memória, com a
        // mesma normalização do usuário.
        var publicadores = await db.Publicadores
            .AsNoTracking()
            .OrderBy(p => p.Nome)
            .Select(p => new PublicadorResponse(
                p.Id, p.Nome, p.Usuario, p.CriancaOuIdoso, p.Administrador, p.Ativo, p.PinHash != null))
            .ToListAsync(ct);

        if (!string.IsNullOrWhiteSpace(busca))
        {
            var termo = UsuarioNormalizado.De(busca);
            publicadores = publicadores
                .Where(p => UsuarioNormalizado.De(p.Nome).Contains(termo)
                    || (p.Usuario is not null && UsuarioNormalizado.De(p.Usuario).Contains(termo)))
                .ToList();
        }

        return Results.Ok(publicadores);
    }

    private static async Task<IResult> CriarAsync(
        CriarPublicadorRequest request,
        AppDbContext db,
        [FromServices] PasswordHasher<object> passwordHasher,
        CancellationToken ct)
    {
        var usuario = request.Usuario.Trim();
        var publicador = new Publicador
        {
            Id = Guid.NewGuid(),
            Nome = request.Nome.Trim(),
            CriancaOuIdoso = request.CriancaOuIdoso,
            Administrador = request.Administrador,
            Usuario = usuario,
            UsuarioNormalizado = UsuarioNormalizado.De(usuario),
        };
        var pin = Pin.Gerar();
        publicador.PinHash = passwordHasher.HashPassword(new object(), pin);

        if (await UsuarioEmUsoAsync(db, publicador.UsuarioNormalizado, publicador.Id, ct))
        {
            return UsuarioEmUso();
        }

        db.Publicadores.Add(publicador);
        if (!await SalvarAsync(db, ct))
        {
            return UsuarioEmUso();
        }

        return Results.Created(
            $"/api/admin/publicadores/{publicador.Id}",
            new CredenciaisResponse(publicador.Id, usuario, pin));
    }

    private static async Task<IResult> EditarAsync(
        Guid id,
        EditarPublicadorRequest request,
        AppDbContext db,
        [FromServices] PasswordHasher<object> passwordHasher,
        CancellationToken ct)
    {
        var publicador = await db.Publicadores.SingleOrDefaultAsync(p => p.Id == id, ct);
        if (publicador is null)
        {
            return Results.NotFound();
        }

        if (request.Nome is not null)
        {
            publicador.Nome = request.Nome.Trim();
        }

        publicador.CriancaOuIdoso = request.CriancaOuIdoso ?? publicador.CriancaOuIdoso;
        publicador.Administrador = request.Administrador ?? publicador.Administrador;

        string? pinGerado = null;
        if (request.Usuario is not null)
        {
            publicador.Usuario = request.Usuario.Trim();
            publicador.UsuarioNormalizado = UsuarioNormalizado.De(publicador.Usuario);
            if (await UsuarioEmUsoAsync(db, publicador.UsuarioNormalizado, publicador.Id, ct))
            {
                return UsuarioEmUso();
            }

            // Registro antigo recebendo usuário: cria as credenciais completas.
            if (publicador.PinHash is null)
            {
                pinGerado = Pin.Gerar();
                publicador.PinHash = passwordHasher.HashPassword(new object(), pinGerado);
            }
        }

        if (!await SalvarAsync(db, ct))
        {
            return UsuarioEmUso();
        }

        return pinGerado is null
            ? Results.NoContent()
            : Results.Ok(new CredenciaisResponse(publicador.Id, publicador.Usuario!, pinGerado));
    }

    private static Task<bool> UsuarioEmUsoAsync(AppDbContext db, string normalizado, Guid id, CancellationToken ct) =>
        db.Publicadores.AnyAsync(p => p.UsuarioNormalizado == normalizado && p.Id != id, ct);

    /// <summary>False se o índice único do usuário recusou (dois admins salvando ao mesmo tempo).</summary>
    private static async Task<bool> SalvarAsync(AppDbContext db, CancellationToken ct)
    {
        try
        {
            await db.SaveChangesAsync(ct);
            return true;
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            return false;
        }
    }

    private static IResult UsuarioEmUso() =>
        Results.Problem(
            title: "Este usuário já está em uso. Escolha outro (ex: MariaS).",
            statusCode: StatusCodes.Status409Conflict,
            extensions: new Dictionary<string, object?> { ["codigo"] = CodigoUsuarioEmUso });
}
