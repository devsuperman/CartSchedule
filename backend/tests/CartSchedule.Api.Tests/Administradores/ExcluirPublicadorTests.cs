using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using CartSchedule.Api.Tests.Infraestrutura;

namespace CartSchedule.Api.Tests.Administradores;

/// <summary>
/// Excluir publicador (issue #61, ADR 0002): apaga a conta e todos os pedidos dela, de todas
/// as escalas. A prévia (GET .../exclusao) mostra quantos pedidos e em quantas escalas.
/// </summary>
public class ExcluirPublicadorTests(ApiFixture fixture) : ApiTestBase(fixture)
{
    private const string RotaAdmin = "/api/admin/publicadores";
    private const string MesPassado = "2026-09";

    private static string RotaPrevia(Guid id) => $"{RotaAdmin}/{id}/exclusao";

    private static string RotaExcluir(Guid id) => $"{RotaAdmin}/{id}";

    /// <summary>
    /// Carrinho com Segunda 08–10 e Terça 08–10; Maria tem 2 pedidos na escala-alvo e 1 numa
    /// escala passada; João tem 1 pedido na escala-alvo, na mesma vaga de Maria.
    /// </summary>
    private async Task<(HttpClient Admin, Guid Maria, Guid Joao, int CarrinhoId)> CenarioAsync()
    {
        var admin = await AdminAsync();
        var (maria, _) = await CriarContaAsync(admin, "Maria", "maria");
        var (joao, _) = await CriarContaAsync(admin, "Joao", "joao");
        var carrinhoId = await CriarCarrinhoAsync(admin);
        (await DefinirTurnosAsync(admin, carrinhoId, (Segunda, Turno0810), (Terca, Turno0810))).EnsureSuccessStatusCode();

        (await AdicionarParaAsync(admin, carrinhoId, Segunda, Turno0810, maria)).EnsureSuccessStatusCode();
        (await AdicionarParaAsync(admin, carrinhoId, Terca, Turno0810, maria)).EnsureSuccessStatusCode();
        (await AdicionarParaAsync(admin, carrinhoId, Segunda, Turno0810, maria, MesPassado)).EnsureSuccessStatusCode();
        (await AdicionarParaAsync(admin, carrinhoId, Segunda, Turno0810, joao)).EnsureSuccessStatusCode();
        return (admin, maria, joao, carrinhoId);
    }

    private static async Task<Guid[]> IdsDosPublicadoresAsync(HttpClient admin) =>
        (await admin.GetFromJsonAsync<JsonElement>($"{RotaAdmin}")).EnumerateArray()
            .Select(p => p.GetProperty("id").GetGuid())
            .ToArray();

    [Fact]
    public async Task Previa_ContaPedidosEEscalas_SemAlterarNada()
    {
        var (admin, maria, _, _) = await CenarioAsync();

        var resposta = await admin.GetAsync(RotaPrevia(maria));

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);
        var corpo = await JsonAsync(resposta);
        Assert.Equal(3, corpo.GetProperty("pedidos").GetInt32());
        Assert.Equal(2, corpo.GetProperty("escalas").GetInt32());
        Assert.Equal(3, PedidosDaGrade(await GradeAsync(admin)).Length);
        Assert.Contains(maria, await IdsDosPublicadoresAsync(admin));
    }

    [Fact]
    public async Task Excluir_ApagaAPessoaETodosOsPedidosDela_EmTodasAsEscalas_SemTocarNosOutros()
    {
        var (admin, maria, joao, _) = await CenarioAsync();

        var resposta = await admin.DeleteAsync(RotaExcluir(maria));

        Assert.Equal(HttpStatusCode.NoContent, resposta.StatusCode);
        Assert.Equal([joao], await IdsDosPublicadoresAsync(admin));
        var pedido = Assert.Single(PedidosDaGrade(await GradeAsync(admin)));
        Assert.Equal(joao, pedido.GetProperty("publicadorId").GetGuid());
        Assert.Empty(PedidosDaGrade(await GradeAsync(admin, MesPassado)));
    }

    [Fact]
    public async Task Excluir_DesconectaOExcluido_ELiberaAVagaParaOutroPublicador()
    {
        var admin = await AdminAsync();
        var carrinhoId = await CriarCarrinhoAsync(admin);
        (await DefinirTurnosAsync(admin, carrinhoId, (Segunda, Turno0810))).EnsureSuccessStatusCode();
        var maria = await PublicadorAsync("Maria");
        var joao = await PublicadorAsync("Joao");
        (await SolicitarAsync(maria, carrinhoId, Segunda, Turno0810)).EnsureSuccessStatusCode();
        (await SolicitarAsync(joao, carrinhoId, Segunda, Turno0810)).EnsureSuccessStatusCode();
        var ana = await PublicadorAsync("Ana");
        Assert.Equal(HttpStatusCode.Conflict, (await SolicitarAsync(ana, carrinhoId, Segunda, Turno0810)).StatusCode);

        (await admin.DeleteAsync(RotaExcluir(await IdDoPublicadorAsync(maria)))).EnsureSuccessStatusCode();

        Assert.Equal(HttpStatusCode.Unauthorized, (await maria.GetAsync("/api/eu")).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await SolicitarAsync(ana, carrinhoId, Segunda, Turno0810)).StatusCode);
    }

    [Fact]
    public async Task PublicadorInexistente_Retorna404_NaPreviaENaExclusao()
    {
        var admin = await AdminAsync();
        var inexistente = Guid.NewGuid();

        Assert.Equal(HttpStatusCode.NotFound, (await admin.GetAsync(RotaPrevia(inexistente))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await admin.DeleteAsync(RotaExcluir(inexistente))).StatusCode);
    }

    [Fact]
    public async Task AdministradorExcluindoAPropriaConta_Retorna409PropriaConta_MasExcluiOutroAdministrador()
    {
        var recuperacao = await AdminAsync();
        var (eu, pin) = await CriarContaAsync(recuperacao, "Maria", "maria", administrador: true);
        var (outroAdmin, _) = await CriarContaAsync(recuperacao, "Joao", "joao", administrador: true);
        var admin = ClienteComToken(await JsonAsync(await LoginAsync(Fixture.Factory.CreateClient(), "maria", pin)));

        var previa = await admin.GetAsync(RotaPrevia(eu));
        var excluir = await admin.DeleteAsync(RotaExcluir(eu));

        Assert.Equal(HttpStatusCode.Conflict, previa.StatusCode);
        Assert.Equal("PROPRIA_CONTA", (await JsonAsync(previa)).GetProperty("codigo").GetString());
        Assert.Equal(HttpStatusCode.Conflict, excluir.StatusCode);
        Assert.Equal("PROPRIA_CONTA", (await JsonAsync(excluir)).GetProperty("codigo").GetString());
        Assert.Contains(eu, await IdsDosPublicadoresAsync(recuperacao));

        Assert.Equal(HttpStatusCode.NoContent, (await admin.DeleteAsync(RotaExcluir(outroAdmin))).StatusCode);
        Assert.Equal([eu], await IdsDosPublicadoresAsync(recuperacao));
    }

    [Fact]
    public async Task PublicadorComum_Recebe403()
    {
        var admin = await AdminAsync();
        var (outro, _) = await CriarContaAsync(admin, "Joao", "joao");
        var publicador = await PublicadorAsync("Maria");

        Assert.Equal(HttpStatusCode.Forbidden, (await publicador.GetAsync(RotaPrevia(outro))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await publicador.DeleteAsync(RotaExcluir(outro))).StatusCode);
        Assert.Contains(outro, await IdsDosPublicadoresAsync(admin));
    }
}
