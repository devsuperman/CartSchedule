using CartSchedule.Api.Domain;
using CartSchedule.Api.Infrastructure;
using CartSchedule.Api.Shared;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace CartSchedule.Api.Features.Administradores.GerenciarCarrinhos;

/// <summary>
/// CRUD de Carrinho (nome, descrição opcional, ativo) para o administrador. A associação com os turnos fixos
/// do sistema é responsabilidade do slice GerenciarTurnosDoCarrinho — aqui, TurnoIds é
/// apenas um campo de leitura de conveniência.
/// </summary>
public static class Endpoint
{
    public static IEndpointRouteBuilder MapGerenciarCarrinhos(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/admin/carrinhos").RequireAuthorization();

        group.MapGet("/", ListarCarrinhosAsync);

        group.MapPost("/", CriarCarrinhoAsync)
            .AddEndpointFilter<ValidationFilter<CriarCarrinhoRequest>>();

        group.MapPut("/{id:int}", AtualizarCarrinhoAsync)
            .AddEndpointFilter<ValidationFilter<AtualizarCarrinhoRequest>>();

        return app;
    }

    private static async Task<Ok<List<CarrinhoResponse>>> ListarCarrinhosAsync(AppDbContext db)
    {
        var carrinhos = await db.Carrinhos
            .AsNoTracking()
            .OrderBy(c => c.Id)
            .Select(c => new CarrinhoResponse(
                c.Id,
                c.Nome,
                c.Descricao,
                c.Ativo,
                c.CarrinhoTurnos.Select(ct => ct.TurnoId).ToList()))
            .ToListAsync();

        return TypedResults.Ok(carrinhos);
    }

    private static async Task<Created<CarrinhoResponse>> CriarCarrinhoAsync(
        CriarCarrinhoRequest request, AppDbContext db)
    {
        var carrinho = new Carrinho
        {
            Nome = request.Nome,
            Descricao = NormalizarDescricao(request.Descricao),
            Ativo = true,
        };

        db.Carrinhos.Add(carrinho);
        await db.SaveChangesAsync();

        var response = new CarrinhoResponse(
            carrinho.Id, carrinho.Nome, carrinho.Descricao, carrinho.Ativo, []);

        return TypedResults.Created($"/api/admin/carrinhos/{carrinho.Id}", response);
    }

    private static async Task<Results<Ok<CarrinhoResponse>, NotFound>> AtualizarCarrinhoAsync(
        int id, AtualizarCarrinhoRequest request, AppDbContext db)
    {
        var carrinho = await db.Carrinhos
            .Include(c => c.CarrinhoTurnos)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (carrinho is null)
        {
            return TypedResults.NotFound();
        }

        carrinho.Nome = request.Nome;
        carrinho.Descricao = NormalizarDescricao(request.Descricao);
        carrinho.Ativo = request.Ativo;

        await db.SaveChangesAsync();

        var response = new CarrinhoResponse(
            carrinho.Id,
            carrinho.Nome,
            carrinho.Descricao,
            carrinho.Ativo,
            carrinho.CarrinhoTurnos.Select(ct => ct.TurnoId).ToList());

        return TypedResults.Ok(response);
    }

    /// <summary>
    /// Descrição em branco (ou só espaços) é gravada como null; caso contrário, sem
    /// espaços nas pontas.
    /// </summary>
    private static string? NormalizarDescricao(string? descricao) =>
        string.IsNullOrWhiteSpace(descricao) ? null : descricao.Trim();
}
