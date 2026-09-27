using CartSchedule.Api.Domain.Enums;

namespace CartSchedule.Api.Features.Administradores.RevisarEscala.AdicionarSolicitacaoManual;

public class Response
{
    public int Id { get; set; }

    public Guid PublicadorId { get; set; }

    public string PublicadorNome { get; set; } = string.Empty;

    public bool CriancaOuIdoso { get; set; }

    public int CarrinhoId { get; set; }

    public DiaSemana DiaSemana { get; set; }

    public int TurnoId { get; set; }

    public OrigemSolicitacao Origem { get; set; }
}
