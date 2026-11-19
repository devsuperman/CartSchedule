using System.Security.Claims;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;

namespace CartSchedule.Api.Infrastructure.Auth;

/// <summary>
/// Conferência feita em todo request autenticado com token de publicador (ADR 0001): a pessoa
/// ainda existe, está ativa, a <c>versaoSessao</c> do token é a atual e o papel do token bate
/// com a marca de administrador. Assim, redefinir/trocar o PIN, desativar ou tirar o
/// administrador desconectam na hora todos os aparelhos (401), sem lista de tokens revogados.
/// O token do administrador de recuperação não tem publicador e não passa por aqui.
/// </summary>
internal static class ValidacaoDaSessao
{
    public static async Task AoValidarTokenAsync(TokenValidatedContext context)
    {
        var principal = context.Principal;
        var idClaim = principal?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (principal is null || idClaim is null)
        {
            return;
        }

        if (!Guid.TryParse(idClaim, out var publicadorId)
            || !int.TryParse(principal.FindFirstValue(ClaimsDaSessao.VersaoSessao), out var versaoDoToken))
        {
            context.Fail("Token de publicador malformado.");
            return;
        }

        var db = context.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
        var atual = await db.Publicadores
            .AsNoTracking()
            .Where(p => p.Id == publicadorId)
            .Select(p => new { p.Ativo, p.VersaoSessao, p.Administrador })
            .SingleOrDefaultAsync(context.HttpContext.RequestAborted);

        var papelAtual = atual?.Administrador == true ? Papeis.Administrador : Papeis.Publicador;
        if (atual is null
            || !atual.Ativo
            || atual.VersaoSessao != versaoDoToken
            || !principal.IsInRole(papelAtual))
        {
            context.Fail("Sessão encerrada.");
        }
    }
}
