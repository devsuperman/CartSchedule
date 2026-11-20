using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using CartSchedule.Api.Tests.Infraestrutura;

namespace CartSchedule.Api.Tests.Administradores;

/// <summary>
/// Unir publicadores duplicados (issue #47): "Unir B em A" move os pedidos de B para A,
/// descarta os de B que A já tem na mesma vaga (duplicidade), passa a marca criança/idoso
/// para A e apaga B. A prévia (GET) mostra quantos serão movidos e descartados.
/// </summary>
public class UnirPublicadoresTests(ApiFixture fixture) : ApiTestBase(fixture)
{
    private const string RotaAdmin = "/api/admin/publicadores";

    private static string RotaUnir(Guid origem, Guid destino) => $"{RotaAdmin}/{origem}/unir/{destino}";

    /// <summary>
    /// Carrinho com Segunda 08–10, Segunda 10–12 e Terça 08–10; A pede Segunda 08–10;
    /// B pede Segunda 08–10 (duplicado de A), Segunda 10–12 e Terça 08–10.
    /// </summary>
    private async Task<(HttpClient Admin, Guid A, Guid B, int CarrinhoId)> CenarioAsync(bool bCriancaOuIdoso = false)
    {
        var admin = await AdminAsync();
        var (a, _) = await CriarContaAsync(admin, "Maria Souza", "maria");
        var (b, _) = await CriarContaAsync(admin, "Maria S.", "marias", criancaOuIdoso: bCriancaOuIdoso);
        var carrinhoId = await CriarCarrinhoAsync(admin);
        (await DefinirTurnosAsync(admin, carrinhoId, (Segunda, Turno0810), (Segunda, Turno1012), (Terca, Turno0810)))
            .EnsureSuccessStatusCode();

        (await AdicionarRegistroAntigoPorNomeAsync(admin, carrinhoId, Segunda, Turno0810, "Maria Souza")).EnsureSuccessStatusCode();
        (await AdicionarRegistroAntigoPorNomeAsync(admin, carrinhoId, Segunda, Turno0810, "Maria S.")).EnsureSuccessStatusCode();
        (await AdicionarRegistroAntigoPorNomeAsync(admin, carrinhoId, Segunda, Turno1012, "Maria S.")).EnsureSuccessStatusCode();
        (await AdicionarRegistroAntigoPorNomeAsync(admin, carrinhoId, Terca, Turno0810, "Maria S.")).EnsureSuccessStatusCode();
        return (admin, a, b, carrinhoId);
    }

    private static async Task<JsonElement[]> PublicadoresAsync(HttpClient admin) =>
        (await admin.GetFromJsonAsync<JsonElement>($"{RotaAdmin}?incluirInativos=true")).EnumerateArray().ToArray();

    [Fact]
    public async Task Previa_ContaPedidosMovidosEDescartados_SemAlterarNada()
    {
        var (admin, a, b, _) = await CenarioAsync();

        var resposta = await admin.GetAsync(RotaUnir(b, a));

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);
        var corpo = await JsonAsync(resposta);
        Assert.Equal(2, corpo.GetProperty("pedidosMovidos").GetInt32());
        Assert.Equal(1, corpo.GetProperty("pedidosDescartados").GetInt32());
        Assert.Equal(4, PedidosDaGrade(await GradeAsync(admin)).Length);
        Assert.Equal(2, (await PublicadoresAsync(admin)).Length);
    }

    [Fact]
    public async Task Unir_MovePedidosParaODestino_DescartaDuplicados_EApagaAOrigem()
    {
        var (admin, a, b, _) = await CenarioAsync();

        var resposta = await admin.PostAsync(RotaUnir(b, a), null);

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);
        var corpo = await JsonAsync(resposta);
        Assert.Equal(2, corpo.GetProperty("pedidosMovidos").GetInt32());
        Assert.Equal(1, corpo.GetProperty("pedidosDescartados").GetInt32());

        var pedidos = PedidosDaGrade(await GradeAsync(admin));
        Assert.Equal(3, pedidos.Length);
        Assert.All(pedidos, p =>
        {
            Assert.Equal(a, p.GetProperty("publicadorId").GetGuid());
            Assert.Equal("Maria Souza", p.GetProperty("publicadorNome").GetString());
            Assert.Equal(3, p.GetProperty("totalNaEscala").GetInt32());
        });
        var vagas = (await GradeAsync(admin)).GetProperty("celulas").EnumerateArray()
            .Where(c => c.GetProperty("publicadores").GetArrayLength() > 0)
            .Select(c => (c.GetProperty("diaSemana").GetInt32(), c.GetProperty("turnoId").GetInt32()))
            .OrderBy(v => v)
            .ToArray();
        Assert.Equal([(Segunda, Turno0810), (Segunda, Turno1012), (Terca, Turno0810)], vagas);

        var restantes = await PublicadoresAsync(admin);
        Assert.Equal(a, Assert.Single(restantes).GetProperty("id").GetGuid());
    }

    [Fact]
    public async Task Unir_OrigemCriancaOuIdoso_PassaAMarcaParaODestino()
    {
        var (admin, a, b, _) = await CenarioAsync(bCriancaOuIdoso: true);

        (await admin.PostAsync(RotaUnir(b, a), null)).EnsureSuccessStatusCode();

        Assert.True(Assert.Single(await PublicadoresAsync(admin)).GetProperty("criancaOuIdoso").GetBoolean());
    }

    [Fact]
    public async Task Unir_DestinoCriancaOuIdoso_NuncaDesmarca()
    {
        var admin = await AdminAsync();
        var (a, _) = await CriarContaAsync(admin, "Avo Jose", "jose", criancaOuIdoso: true);
        var (b, _) = await CriarContaAsync(admin, "Jose", "josé2");

        (await admin.PostAsync(RotaUnir(b, a), null)).EnsureSuccessStatusCode();

        Assert.True(Assert.Single(await PublicadoresAsync(admin)).GetProperty("criancaOuIdoso").GetBoolean());
    }

    [Fact]
    public async Task OrigemIgualAoDestino_Retorna400_NaPreviaENaExecucao()
    {
        var admin = await AdminAsync();
        var (a, _) = await CriarContaAsync(admin, "Maria", "maria");

        Assert.Equal(HttpStatusCode.BadRequest, (await admin.GetAsync(RotaUnir(a, a))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsync(RotaUnir(a, a), null)).StatusCode);
        Assert.Single(await PublicadoresAsync(admin));
    }

    [Fact]
    public async Task PublicadorInexistente_Retorna404_NaPreviaENaExecucao()
    {
        var admin = await AdminAsync();
        var (a, _) = await CriarContaAsync(admin, "Maria", "maria");
        var inexistente = Guid.NewGuid();

        Assert.Equal(HttpStatusCode.NotFound, (await admin.GetAsync(RotaUnir(inexistente, a))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await admin.GetAsync(RotaUnir(a, inexistente))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await admin.PostAsync(RotaUnir(inexistente, a), null)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await admin.PostAsync(RotaUnir(a, inexistente), null)).StatusCode);
        Assert.Single(await PublicadoresAsync(admin));
    }

    [Fact]
    public async Task PublicadorComum_Recebe403()
    {
        var admin = await AdminAsync();
        var (a, pin) = await CriarContaAsync(admin, "Maria", "maria");
        var (b, _) = await CriarContaAsync(admin, "Joao", "joao");
        var login = await LoginAsync(Fixture.Factory.CreateClient(), "maria", pin);
        var publicador = ClienteComToken(await JsonAsync(login));

        Assert.Equal(HttpStatusCode.Forbidden, (await publicador.PostAsync(RotaUnir(b, a), null)).StatusCode);
        Assert.Equal(2, (await PublicadoresAsync(admin)).Length);
    }

    [Fact]
    public async Task AdministradorUnindoAPropriaConta_Retorna409PropriaConta_EOutroSentidoFunciona()
    {
        var recuperacao = await AdminAsync();
        var (eu, pin) = await CriarContaAsync(recuperacao, "Maria", "maria", administrador: true);
        var (outro, _) = await CriarContaAsync(recuperacao, "Maria S.", "marias");
        var admin = ClienteComToken(await JsonAsync(await LoginAsync(Fixture.Factory.CreateClient(), "maria", pin)));

        var previa = await admin.GetAsync(RotaUnir(eu, outro));
        var unir = await admin.PostAsync(RotaUnir(eu, outro), null);

        Assert.Equal(HttpStatusCode.Conflict, previa.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, unir.StatusCode);
        Assert.Equal("PROPRIA_CONTA", (await JsonAsync(unir)).GetProperty("codigo").GetString());
        Assert.Equal(2, (await PublicadoresAsync(recuperacao)).Length);

        Assert.Equal(HttpStatusCode.OK, (await admin.PostAsync(RotaUnir(outro, eu), null)).StatusCode);
        Assert.Equal(eu, Assert.Single(await PublicadoresAsync(recuperacao)).GetProperty("id").GetGuid());
    }
}
