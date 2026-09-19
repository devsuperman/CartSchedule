namespace CartSchedule.Api.Features.Administradores.GerenciarTurnosDoCarrinho;

public class TurnosDoCarrinhoResponse
{
    public int CarrinhoId { get; set; }

    public List<int> TurnoIds { get; set; } = [];
}
