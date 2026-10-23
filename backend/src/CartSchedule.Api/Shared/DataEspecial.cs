using CartSchedule.Api.Domain.Enums;

namespace CartSchedule.Api.Shared;

/// <summary>Datas de carrinhos especiais (PLANNING.md regra 10a): só Segunda a Sexta.</summary>
public static class DataEspecial
{
    /// <summary>Dia da semana da data, ou null se cair no fim de semana.</summary>
    public static DiaSemana? DiaSemanaDe(DateOnly data) =>
        data.DayOfWeek is >= DayOfWeek.Monday and <= DayOfWeek.Friday ? (DiaSemana)(int)data.DayOfWeek : null;

    /// <summary>Mês de referência (primeiro dia) da escala em que a data cai.</summary>
    public static DateOnly MesDe(DateOnly data) => new(data.Year, data.Month, 1);

    /// <summary>Mensagem usada quando a data especial cai no fim de semana.</summary>
    public const string MensagemDiaUtil = "A data especial precisa cair de Segunda a Sexta.";

    /// <summary>Carrinho normal (null) ou data especial de Segunda a Sexta.</summary>
    public static bool EhDiaUtil(DateOnly? data) => data is null || DiaSemanaDe(data.Value) is not null;

    /// <summary>
    /// Carrinho normal cabe em qualquer escala; carrinho de data especial só na escala do mês
    /// da data (regra 10a).
    /// </summary>
    public static bool CabeNaEscala(DateOnly? dataEspecial, DateOnly mesEscala) =>
        dataEspecial is null || MesDe(dataEspecial.Value) == mesEscala;
}
