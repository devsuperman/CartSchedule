using CartSchedule.Api.Domain;
using CartSchedule.Api.Domain.Enums;
using CartSchedule.Api.Infrastructure;
using CartSchedule.Api.Shared;
using Microsoft.EntityFrameworkCore;

namespace CartSchedule.Api.Features.Administradores.RevisarEscala.AdicionarSolicitacaoManual;

/// <summary>
/// POST /api/admin/escalas/{mes}/solicitacoes — adição manual de solicitação pelo
/// administrador (PLANNING.md regra 9, TECHNICAL_SPEC.md §2.3), origem
/// Administrador; como toda solicitação, já conta na escala. O administrador não é limitado pela janela de envio (regra 7):
/// {mes} pode ser qualquer escala, passada, atual ou futura.
/// </summary>
public static class Endpoint
{
    public static IEndpointRouteBuilder MapAdicionarSolicitacaoManual(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/admin/escalas/{mes}/solicitacoes", HandleAsync)
            .AddEndpointFilter<ValidationFilter<Request>>()
            .RequireAuthorization();

        return app;
    }

    private static async Task<IResult> HandleAsync(string mes, Request request, AppDbContext db, CancellationToken ct)
    {
        if (!TryParseMesReferencia(mes, out var mesReferencia))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["mes"] = ["Formato inválido. Use yyyy-MM (ex: 2026-10)."],
            });
        }

        var carrinhoTurnoExiste = await db.CarrinhoTurnos
            .AnyAsync(
                ct2 => ct2.CarrinhoId == request.CarrinhoId
                    && ct2.DiaSemana == request.DiaSemana
                    && ct2.TurnoId == request.TurnoId,
                ct);

        if (!carrinhoTurnoExiste)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["turnoId"] = ["O turno informado não está disponível para esse carrinho nesse dia da semana."],
            });
        }

        var escala = await EscalaHelpers.ObterOuCriarAsync(db, mesReferencia, ct);

        var nomeSolicitado = request.Nome.Trim();

        var publicador = await db.Publicadores
            .FirstOrDefaultAsync(p => p.Nome == nomeSolicitado, ct);

        if (publicador is null)
        {
            publicador = new Publicador
            {
                Id = Guid.NewGuid(),
                Nome = nomeSolicitado,
            };
            db.Publicadores.Add(publicador);
        }

        var jaExiste = await db.Solicitacoes.AnyAsync(
            s => s.PublicadorId == publicador.Id
                && s.EscalaId == escala.Id
                && s.CarrinhoId == request.CarrinhoId
                && s.DiaSemana == request.DiaSemana
                && s.TurnoId == request.TurnoId,
            ct);

        if (jaExiste)
        {
            return Results.Conflict(new
            {
                title = "Solicitação duplicada.",
                detail = "Este publicador já possui uma solicitação para essa combinação de carrinho, dia da semana e turno nessa escala.",
            });
        }

        var solicitacao = new Solicitacao
        {
            PublicadorId = publicador.Id,
            Publicador = publicador,
            EscalaId = escala.Id,
            CarrinhoId = request.CarrinhoId,
            DiaSemana = request.DiaSemana,
            TurnoId = request.TurnoId,
            Origem = OrigemSolicitacao.Administrador,
            CriadoEm = DateTimeOffset.UtcNow,
        };

        db.Solicitacoes.Add(solicitacao);
        await db.SaveChangesAsync(ct);

        var response = new Response
        {
            Id = solicitacao.Id,
            PublicadorId = publicador.Id,
            PublicadorNome = publicador.Nome,
            CarrinhoId = solicitacao.CarrinhoId,
            DiaSemana = solicitacao.DiaSemana,
            TurnoId = solicitacao.TurnoId,
            Origem = solicitacao.Origem,
        };

        return Results.Created($"/api/admin/escalas/{mes}/solicitacoes/{solicitacao.Id}", response);
    }

    private static bool TryParseMesReferencia(string mes, out DateOnly mesReferencia)
    {
        mesReferencia = default;

        var partes = mes.Split('-');
        if (partes.Length != 2)
        {
            return false;
        }

        if (!int.TryParse(partes[0], out var ano) || !int.TryParse(partes[1], out var mesNumero))
        {
            return false;
        }

        if (mesNumero is < 1 or > 12)
        {
            return false;
        }

        mesReferencia = new DateOnly(ano, mesNumero, 1);
        return true;
    }
}
