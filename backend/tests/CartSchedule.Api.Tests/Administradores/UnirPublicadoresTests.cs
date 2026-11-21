using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using CartSchedule.Api.Tests.Infraestrutura;

namespace CartSchedule.Api.Tests.Administradores;

/// <summary>
/// Unir publicadores duplicados (issues #47 e #67): "Unir outros registros a este" parte do
/// registro que fica (A) e une a ele uma ou mais origens (B, C…): os pedidos delas passam a A,
/// que fica com um só pedido por vaga (duplicidade — com os dele ou entre origens), a marca
/// criança/idoso passa a A e as origens são apagadas. A prévia mostra quantos serão movidos e
/// descartados, sem alterar nada.
/// </summary>
public class UnirPublicadoresTests(ApiFixture fixture) : ApiTestBase(fixture)
{
    private const string RotaAdmin = "/api/admin/publicadores";

    private static Task<HttpResponseMessage> PreviaAsync(HttpClient cliente, Guid destino, params Guid[] origens) =>
        cliente.PostAsJsonAsync($"{RotaAdmin}/{destino}/unir/previa", new { origemIds = origens });

    private static Task<HttpResponseMessage> UnirAsync(HttpClient cliente, Guid destino, params Guid[] origens) =>
        cliente.PostAsJsonAsync($"{RotaAdmin}/{destino}/unir", new { origemIds = origens });

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
        (await admin.GetFromJsonAsync<JsonElement>($"{RotaAdmin}")).EnumerateArray().ToArray();

    [Fact]
    public async Task Previa_ContaPedidosMovidosEDescartados_SemAlterarNada()
    {
        var (admin, a, b, _) = await CenarioAsync();

        var resposta = await PreviaAsync(admin, a, b);

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

        var resposta = await UnirAsync(admin, a, b);

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

        (await UnirAsync(admin, a, b)).EnsureSuccessStatusCode();

        Assert.True(Assert.Single(await PublicadoresAsync(admin)).GetProperty("criancaOuIdoso").GetBoolean());
    }

    [Fact]
    public async Task Unir_DestinoCriancaOuIdoso_NuncaDesmarca()
    {
        var admin = await AdminAsync();
        var (a, _) = await CriarContaAsync(admin, "Avo Jose", "jose", criancaOuIdoso: true);
        var (b, _) = await CriarContaAsync(admin, "Jose", "josé2");

        (await UnirAsync(admin, a, b)).EnsureSuccessStatusCode();

        Assert.True(Assert.Single(await PublicadoresAsync(admin)).GetProperty("criancaOuIdoso").GetBoolean());
    }

    [Fact]
    public async Task OrigemIgualAoDestino_Retorna400_NaPreviaENaExecucao()
    {
        var admin = await AdminAsync();
        var (a, _) = await CriarContaAsync(admin, "Maria", "maria");

        Assert.Equal(HttpStatusCode.BadRequest, (await PreviaAsync(admin, a, a)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await UnirAsync(admin, a, a)).StatusCode);
        Assert.Single(await PublicadoresAsync(admin));
    }

    [Fact]
    public async Task PublicadorInexistente_Retorna404_NaPreviaENaExecucao()
    {
        var admin = await AdminAsync();
        var (a, _) = await CriarContaAsync(admin, "Maria", "maria");
        var inexistente = Guid.NewGuid();

        Assert.Equal(HttpStatusCode.NotFound, (await PreviaAsync(admin, a, inexistente)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await PreviaAsync(admin, inexistente, a)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await UnirAsync(admin, a, inexistente)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await UnirAsync(admin, inexistente, a)).StatusCode);
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

        Assert.Equal(HttpStatusCode.Forbidden, (await UnirAsync(publicador, a, b)).StatusCode);
        Assert.Equal(2, (await PublicadoresAsync(admin)).Length);
    }

    [Fact]
    public async Task AdministradorUnindoAPropriaConta_Retorna409PropriaConta_EOutroSentidoFunciona()
    {
        var recuperacao = await AdminAsync();
        var (eu, pin) = await CriarContaAsync(recuperacao, "Maria", "maria", administrador: true);
        var (outro, _) = await CriarContaAsync(recuperacao, "Maria S.", "marias");
        var admin = ClienteComToken(await JsonAsync(await LoginAsync(Fixture.Factory.CreateClient(), "maria", pin)));

        var previa = await PreviaAsync(admin, outro, eu);
        var unir = await UnirAsync(admin, outro, eu);

        Assert.Equal(HttpStatusCode.Conflict, previa.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, unir.StatusCode);
        Assert.Equal("PROPRIA_CONTA", (await JsonAsync(unir)).GetProperty("codigo").GetString());
        Assert.Equal(2, (await PublicadoresAsync(recuperacao)).Length);

        Assert.Equal(HttpStatusCode.OK, (await UnirAsync(admin, eu, outro)).StatusCode);
        Assert.Equal(eu, Assert.Single(await PublicadoresAsync(recuperacao)).GetProperty("id").GetGuid());
    }

    /// <summary>
    /// Carrinho com Segunda 08–10, Segunda 10–12 e Terça 08–10; A pede Segunda 08–10;
    /// B pede Segunda 08–10 (como A) e Segunda 10–12; C pede Segunda 10–12 (como B) e Terça 08–10.
    /// </summary>
    private async Task<(HttpClient Admin, Guid A, Guid B, Guid C)> CenarioComDuasOrigensAsync()
    {
        var admin = await AdminAsync();
        var (a, _) = await CriarContaAsync(admin, "Maria Souza", "maria");
        var (b, _) = await CriarContaAsync(admin, "Maria S.", "marias");
        var (c, _) = await CriarContaAsync(admin, "Mariazinha", "mariazinha");
        var carrinhoId = await CriarCarrinhoAsync(admin);
        (await DefinirTurnosAsync(admin, carrinhoId, (Segunda, Turno0810), (Segunda, Turno1012), (Terca, Turno0810)))
            .EnsureSuccessStatusCode();

        (await AdicionarParaAsync(admin, carrinhoId, Segunda, Turno0810, a)).EnsureSuccessStatusCode();
        (await AdicionarParaAsync(admin, carrinhoId, Segunda, Turno0810, b)).EnsureSuccessStatusCode();
        (await AdicionarParaAsync(admin, carrinhoId, Segunda, Turno1012, b)).EnsureSuccessStatusCode();
        (await AdicionarParaAsync(admin, carrinhoId, Segunda, Turno1012, c)).EnsureSuccessStatusCode();
        (await AdicionarParaAsync(admin, carrinhoId, Terca, Turno0810, c)).EnsureSuccessStatusCode();
        return (admin, a, b, c);
    }

    [Fact]
    public async Task UnirVarias_DestinoFicaComUmPedidoPorVaga_DescartandoColisoesEntreOrigens()
    {
        var (admin, a, b, c) = await CenarioComDuasOrigensAsync();

        var previa = await JsonAsync(await PreviaAsync(admin, a, b, c));
        var resposta = await UnirAsync(admin, a, b, c);

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);
        var corpo = await JsonAsync(resposta);
        Assert.Equal(2, corpo.GetProperty("pedidosMovidos").GetInt32());
        Assert.Equal(2, corpo.GetProperty("pedidosDescartados").GetInt32());
        Assert.Equal(2, previa.GetProperty("pedidosMovidos").GetInt32());
        Assert.Equal(2, previa.GetProperty("pedidosDescartados").GetInt32());

        var grade = await GradeAsync(admin);
        Assert.All(PedidosDaGrade(grade), p => Assert.Equal(a, p.GetProperty("publicadorId").GetGuid()));
        var vagas = grade.GetProperty("celulas").EnumerateArray()
            .Where(cel => cel.GetProperty("publicadores").GetArrayLength() > 0)
            .Select(cel => (cel.GetProperty("diaSemana").GetInt32(), cel.GetProperty("turnoId").GetInt32(),
                cel.GetProperty("publicadores").GetArrayLength()))
            .OrderBy(v => v)
            .ToArray();
        Assert.Equal([(Segunda, Turno0810, 1), (Segunda, Turno1012, 1), (Terca, Turno0810, 1)], vagas);
        Assert.Equal(a, Assert.Single(await PublicadoresAsync(admin)).GetProperty("id").GetGuid());
    }

    [Fact]
    public async Task UnirVarias_CriancaOuIdosoDeQualquerOrigem_PassaAoDestino_EAdministradorNao()
    {
        var recuperacao = await AdminAsync();
        var (a, _) = await CriarContaAsync(recuperacao, "Maria Souza", "maria");
        var (b, _) = await CriarContaAsync(recuperacao, "Maria S.", "marias", administrador: true);
        var (c, _) = await CriarContaAsync(recuperacao, "Mariazinha", "mariazinha", criancaOuIdoso: true);

        (await UnirAsync(recuperacao, a, b, c)).EnsureSuccessStatusCode();

        var destino = Assert.Single(await PublicadoresAsync(recuperacao));
        Assert.True(destino.GetProperty("criancaOuIdoso").GetBoolean());
        Assert.False(destino.GetProperty("administrador").GetBoolean());
    }

    [Fact]
    public async Task UnirVarias_OrigensDeixamDeEntrar_EODestinoContinuaLogado()
    {
        var admin = await AdminAsync();
        var (a, pinA) = await CriarContaAsync(admin, "Maria Souza", "maria");
        var (b, pinB) = await CriarContaAsync(admin, "Maria S.", "marias");
        var (c, pinC) = await CriarContaAsync(admin, "Mariazinha", "mariazinha");
        var sessaoA = ClienteComToken(await JsonAsync(await LoginAsync(Fixture.Factory.CreateClient(), "maria", pinA)));
        var sessaoB = ClienteComToken(await JsonAsync(await LoginAsync(Fixture.Factory.CreateClient(), "marias", pinB)));
        var sessaoC = ClienteComToken(await JsonAsync(await LoginAsync(Fixture.Factory.CreateClient(), "mariazinha", pinC)));

        (await UnirAsync(admin, a, b, c)).EnsureSuccessStatusCode();

        Assert.Equal(HttpStatusCode.OK, (await sessaoA.GetAsync("/api/eu")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await sessaoB.GetAsync("/api/eu")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await sessaoC.GetAsync("/api/eu")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await LoginAsync(Fixture.Factory.CreateClient(), "maria", pinA)).StatusCode);
        Assert.NotEqual(HttpStatusCode.OK, (await LoginAsync(Fixture.Factory.CreateClient(), "marias", pinB)).StatusCode);
    }

    [Fact]
    public async Task UmaOrigemInexistente_Retorna404_ENadaMuda()
    {
        var (admin, a, b, c) = await CenarioComDuasOrigensAsync();
        var inexistente = Guid.NewGuid();

        Assert.Equal(HttpStatusCode.NotFound, (await PreviaAsync(admin, a, b, inexistente, c)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await UnirAsync(admin, a, b, inexistente, c)).StatusCode);

        Assert.Equal(3, (await PublicadoresAsync(admin)).Length);
        Assert.Equal(5, PedidosDaGrade(await GradeAsync(admin)).Length);
    }

    [Fact]
    public async Task ListaVaziaOuRepetida_Retorna400()
    {
        var admin = await AdminAsync();
        var (a, _) = await CriarContaAsync(admin, "Maria", "maria");
        var (b, _) = await CriarContaAsync(admin, "Maria S.", "marias");

        Assert.Equal(HttpStatusCode.BadRequest, (await PreviaAsync(admin, a)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await UnirAsync(admin, a)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await UnirAsync(admin, a, b, b)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await UnirAsync(admin, a, b, a)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await admin.PostAsJsonAsync($"{RotaAdmin}/{a}/unir", new { })).StatusCode);
        Assert.Equal(2, (await PublicadoresAsync(admin)).Length);
    }

    [Fact]
    public async Task AdministradorUneOutroAdministradorASuaConta()
    {
        var recuperacao = await AdminAsync();
        var (eu, pin) = await CriarContaAsync(recuperacao, "Maria", "maria", administrador: true);
        var (outroAdmin, _) = await CriarContaAsync(recuperacao, "Joao", "joao", administrador: true);
        var (outro, _) = await CriarContaAsync(recuperacao, "Maria S.", "marias");
        var admin = ClienteComToken(await JsonAsync(await LoginAsync(Fixture.Factory.CreateClient(), "maria", pin)));

        Assert.Equal(HttpStatusCode.OK, (await UnirAsync(admin, eu, outroAdmin, outro)).StatusCode);

        Assert.Equal(eu, Assert.Single(await PublicadoresAsync(recuperacao)).GetProperty("id").GetGuid());
    }

    [Fact]
    public async Task RotaAntiga_NaoExisteMais()
    {
        var admin = await AdminAsync();
        var (a, _) = await CriarContaAsync(admin, "Maria", "maria");
        var (b, _) = await CriarContaAsync(admin, "Maria S.", "marias");

        Assert.Equal(HttpStatusCode.NotFound, (await admin.GetAsync($"{RotaAdmin}/{b}/unir/{a}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await admin.PostAsync($"{RotaAdmin}/{b}/unir/{a}", null)).StatusCode);
        Assert.Equal(2, (await PublicadoresAsync(admin)).Length);
    }
}
