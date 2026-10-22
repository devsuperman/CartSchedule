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
}
