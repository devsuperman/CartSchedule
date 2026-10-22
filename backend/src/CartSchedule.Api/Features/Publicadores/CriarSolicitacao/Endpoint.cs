using CartSchedule.Api.Domain;
using CartSchedule.Api.Domain.Enums;
using CartSchedule.Api.Infrastructure;
using CartSchedule.Api.Infrastructure.RateLimiting;
using CartSchedule.Api.Shared;
using Microsoft.EntityFrameworkCore;

namespace CartSchedule.Api.Features.Publicadores.CriarSolicitacao;

public static class Endpoint
{
    public static IEndpointRouteBuilder MapCriarSolicitacao(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/solicitacoes", HandleAsync)
            .AddEndpointFilter<ValidationFilter<Request>>()
            .RequireRateLimiting(RateLimitingExtensions.PoliticaEscritaPublicador);

        return app;
    }

    private static async Task<IResult> HandleAsync(
        HttpContext httpContext,
        AppDbContext db,
        TimeProvider relogio,
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

        var janela = await JanelaDeEnvio.CalcularParaHojeAsync(db, relogio, ct);
        if (!janela.Aberta)
        {
            return Results.Problem(
                title: "Janela de envio fechada",
                detail: "O envio de novas solicitações está fechado. Ele abre novamente no dia 15.",
                statusCode: StatusCodes.Status400BadRequest,
                extensions: new Dictionary<string, object?> { ["codigo"] = JanelaDeEnvio.CodigoJanelaFechada });
        }

        var vaga = await db.CarrinhoTurnos
            .Where(ct2 => ct2.CarrinhoId == request.CarrinhoId
                && ct2.DiaSemana == request.DiaSemana
                && ct2.TurnoId == request.TurnoId)
            .Select(ct2 => new { ct2.Carrinho.DataEspecial })
            .FirstOrDefaultAsync(ct);

        if (vaga is null)
        {
            return Results.Problem(
                title: "Turno indisponível para o carrinho selecionado",
                detail: "O turno escolhido não está disponível para esse carrinho nesse dia da semana.",
                statusCode: StatusCodes.Status400BadRequest);
        }

        // Regra 10a: o carrinho de data especial só recebe pedidos na escala do mês da data.
        if (vaga.DataEspecial is { } data && DataEspecial.MesDe(data) != janela.MesAlvo)
        {
            return Results.Problem(
                title: "Carrinho fora desta escala",
                detail: "Esse carrinho só funciona numa data especial de outro mês.",
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

        // Contagem + inserção na mesma transação, serializada por escala: sem o lock, dois
        // envios simultâneos para a última vaga leriam a mesma contagem e passariam juntos.
        await using var transacao = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock({escala.Id})", ct);

        // Regra 10: quem já tem pedido nesse dia e turno (em qualquer carrinho do mesmo grupo — a
        // mesma trinca é o caso particular) não pode pedir de novo; não dá para estar em dois
        // lugares ao mesmo tempo. Carrinho de data especial não conflita com a escala semanal (10a).
        var horarioOcupado = await db.Solicitacoes.AnyAsync(
            HorarioOcupado.NoHorario(publicadorId, escala.Id, request.DiaSemana, request.TurnoId, vaga.DataEspecial),
            ct);

        if (horarioOcupado)
        {
            return Results.Problem(
                title: "Horário ocupado",
                detail: "Você já tem pedido nesse dia e horário nesta escala.",
                statusCode: StatusCodes.Status409Conflict,
                extensions: new Dictionary<string, object?> { ["codigo"] = HorarioOcupado.Codigo });
        }

        var ocupacao = await db.Solicitacoes.CountAsync(
            s => s.EscalaId == escala.Id
                && s.CarrinhoId == request.CarrinhoId
                && s.DiaSemana == request.DiaSemana
                && s.TurnoId == request.TurnoId,
            ct);

        if (ocupacao >= LotacaoDaVaga.LimiteParaPublicador)
        {
            return Results.Problem(
                title: "Vaga cheia",
                detail: "Esse carrinho, dia e turno já está cheio. Escolha outra vaga.",
                statusCode: StatusCodes.Status409Conflict,
                extensions: new Dictionary<string, object?> { ["codigo"] = LotacaoDaVaga.CodigoVagaCheia });
        }

        var solicitacao = new Solicitacao
        {
            PublicadorId = publicadorId,
            EscalaId = escala.Id,
            CarrinhoId = request.CarrinhoId,
            DiaSemana = request.DiaSemana,
            TurnoId = request.TurnoId,
            Origem = OrigemSolicitacao.Publicador,
            CriadoEm = DateTimeOffset.UtcNow,
        };

        db.Solicitacoes.Add(solicitacao);
        await db.SaveChangesAsync(ct);
        await transacao.CommitAsync(ct);

        var response = new Response(
            solicitacao.Id,
            solicitacao.CarrinhoId,
            solicitacao.DiaSemana,
            solicitacao.TurnoId,
            solicitacao.CriadoEm);

        return Results.Created($"/api/solicitacoes/{solicitacao.Id}", response);
    }
}
