using CartSchedule.Api.Domain;
using CartSchedule.Api.Domain.Enums;
using CartSchedule.Api.Infrastructure;
using CartSchedule.Api.Shared;
using Microsoft.EntityFrameworkCore;

namespace CartSchedule.Api.Features.Publicadores.CriarSolicitacao;

public static class Endpoint
{
    public static IEndpointRouteBuilder MapCriarSolicitacao(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/solicitacoes", HandleAsync)
            .AddEndpointFilter<ValidationFilter<Request>>();

        return app;
    }

    private static async Task<IResult> HandleAsync(
        HttpContext httpContext,
        AppDbContext db,
        Request request,
        CancellationToken ct)
    {
        if (!httpContext.Request.Headers.TryGetValue("X-Publicador-Token", out var tokenHeader)
            || !Guid.TryParse(tokenHeader, out var publicadorId))
        {
            return Results.Problem(
                title: "Token de publicador ausente ou inválido",
                detail: "Envie o header X-Publicador-Token com um GUID válido.",
                statusCode: StatusCodes.Status400BadRequest);
        }

        var janela = JanelaDeEnvio.CalcularParaHoje();
        if (!janela.Aberta)
        {
            return Results.Problem(
                title: "Janela de envio fechada",
                detail: "O envio de novas solicitações só é permitido entre os dias 15 e 25 do mês.",
                statusCode: StatusCodes.Status400BadRequest);
        }

        var turnoPertenceAoCarrinho = await db.CarrinhoTurnos
            .AnyAsync(ct2 => ct2.CarrinhoId == request.CarrinhoId && ct2.TurnoId == request.TurnoId, ct);

        if (!turnoPertenceAoCarrinho)
        {
            return Results.Problem(
                title: "Turno indisponível para o carrinho selecionado",
                detail: "O turno escolhido não está configurado como disponível para o carrinho selecionado.",
                statusCode: StatusCodes.Status400BadRequest);
        }

        var publicador = await db.Publicadores.FirstOrDefaultAsync(p => p.Id == publicadorId, ct);
        if (publicador is null)
        {
            publicador = new Publicador { Id = publicadorId, Nome = request.Nome };
            db.Publicadores.Add(publicador);
        }
        else
        {
            publicador.Nome = request.Nome;
        }

        var escala = await EscalaHelpers.ObterOuCriarAsync(db, janela.MesAlvo, ct);

        var duplicada = await db.Solicitacoes.AnyAsync(
            s => s.PublicadorId == publicadorId
                && s.EscalaId == escala.Id
                && s.CarrinhoId == request.CarrinhoId
                && s.DiaSemana == request.DiaSemana
                && s.TurnoId == request.TurnoId,
            ct);

        if (duplicada)
        {
            return Results.Problem(
                title: "Solicitação duplicada",
                detail: "Você já enviou uma solicitação para esse carrinho, dia e turno nesta escala.",
                statusCode: StatusCodes.Status409Conflict);
        }

        var solicitacao = new Solicitacao
        {
            PublicadorId = publicadorId,
            EscalaId = escala.Id,
            CarrinhoId = request.CarrinhoId,
            DiaSemana = request.DiaSemana,
            TurnoId = request.TurnoId,
            Status = StatusSolicitacao.Pendente,
            Origem = OrigemSolicitacao.Publicador,
            CriadoEm = DateTimeOffset.UtcNow,
            DecididoEm = null,
        };

        db.Solicitacoes.Add(solicitacao);
        await db.SaveChangesAsync(ct);

        var response = new Response(
            solicitacao.Id,
            solicitacao.CarrinhoId,
            solicitacao.DiaSemana,
            solicitacao.TurnoId,
            solicitacao.Status,
            solicitacao.CriadoEm);

        return Results.Created($"/api/solicitacoes/{solicitacao.Id}", response);
    }
}
