using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace CartSchedule.Api.Shared;

/// <summary>
/// Usuário de login (GLOSSARY.md): único sem diferenciar maiúsculas nem acentos —
/// "maria", "Maria" e "María" são o mesmo. A forma normalizada vai numa coluna com
/// índice único; a digitada fica para exibição.
/// </summary>
public static class UsuarioNormalizado
{
    public static string De(string usuario)
    {
        var decomposto = usuario.Trim().Normalize(NormalizationForm.FormD);
        var semAcentos = new StringBuilder(decomposto.Length);
        foreach (var c in decomposto)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
            {
                semAcentos.Append(c);
            }
        }

        return semAcentos.ToString().Normalize(NormalizationForm.FormC).ToLowerInvariant();
    }
}

/// <summary>
/// PIN do publicador (GLOSSARY.md): exatamente 4 dígitos. O sistema gera com gerador
/// criptográfico e nunca gera um PIN óbvio (todos iguais ou sequência como 1234/4321).
/// </summary>
public static class Pin
{
    /// <summary>Exatamente 4 dígitos de 0 a 9 (sem espaços nem dígitos de outros alfabetos).</summary>
    public static bool TemFormatoValido(string? pin) =>
        pin is { Length: 4 } && pin.All(char.IsAsciiDigit);

    public const string MensagemDeFormato = "O PIN precisa ter exatamente 4 dígitos.";

    /// <summary>Todos iguais ou sequência crescente/decrescente. Só para PIN com formato válido.</summary>
    public static bool EhFraco(string pin)
    {
        var d = pin.Select(c => c - '0').ToArray();
        var passos = d.Zip(d.Skip(1), (a, b) => b - a).Distinct().ToArray();
        // Todos iguais (passo 0) ou sequência crescente/decrescente (passo ±1).
        return passos.Length == 1 && Math.Abs(passos[0]) <= 1;
    }

    public static string Gerar()
    {
        while (true)
        {
            var pin = RandomNumberGenerator.GetInt32(0, 10_000).ToString("D4", CultureInfo.InvariantCulture);
            if (!EhFraco(pin))
            {
                return pin;
            }
        }
    }
}
