using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using CartSchedule.Api.Tests.Infraestrutura;

namespace CartSchedule.Api.Tests.Shared;

/// <summary>
/// Carrinho de data especial (PLANNING.md regra 10a): funciona numa data só, aparece só na
/// escala do mês dela e não ocupa o horário da escala semanal (nem o contrário). A escala-alvo
/// dos testes é outubro/2026; 14/10/2026 é uma quarta-feira.
/// </summary>
public class CarrinhoDataEspecialTests(ApiFixture fixture) : ApiTestBase(fixture)
{
    private const string QuartaDeOutubro = "2026-10-14";
    private const string QuartaDeNovembro = "2026-11-11";

    /// <summary>Um carrinho normal e um especial, os dois com Quarta 08–10.</summary>
    private async Task<(int Normal, int Especial)> NormalEEspecialNaQuarta0810Async()
    {
        var admin = await AdminAsync();
        var normal = await CriarCarrinhoAsync(admin, "Carrinho 01");
        var especial = await CriarCarrinhoEspecialAsync(admin, QuartaDeOutubro);
        await DefinirTurnosAsync(admin, normal, (Quarta, Turno0810));
        (await DefinirTurnosAsync(admin, especial, (Quarta, Turno0810))).EnsureSuccessStatusCode();
        return (normal, especial);
    }

    [Fact]
    public async Task PedidoNoNormal_NaoOcupaOHorarioDoEspecial_NemOContrario()
    {
        var (normal, especial) = await NormalEEspecialNaQuarta0810Async();
        var ana = await PublicadorAsync("Ana");
        var bia = await PublicadorAsync("Bia");

        Assert.Equal(HttpStatusCode.Created, (await SolicitarAsync(ana, normal, Quarta, Turno0810)).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await SolicitarAsync(ana, especial, Quarta, Turno0810)).StatusCode);

        Assert.Equal(HttpStatusCode.Created, (await SolicitarAsync(bia, especial, Quarta, Turno0810)).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await SolicitarAsync(bia, normal, Quarta, Turno0810)).StatusCode);
    }

    [Fact]
    public async Task DoisEspeciaisNaMesmaData_ContinuamOcupandoOHorario()
    {
        var admin = await AdminAsync();
        var primeiro = await CriarCarrinhoEspecialAsync(admin, QuartaDeOutubro, "Evento A");
        var segundo = await CriarCarrinhoEspecialAsync(admin, QuartaDeOutubro, "Evento B");
        await DefinirTurnosAsync(admin, primeiro, (Quarta, Turno0810));
        await DefinirTurnosAsync(admin, segundo, (Quarta, Turno0810));
        var publicador = await PublicadorAsync();
        await SolicitarAsync(publicador, primeiro, Quarta, Turno0810);

        var resposta = await SolicitarAsync(publicador, segundo, Quarta, Turno0810);

        Assert.Equal(HttpStatusCode.Conflict, resposta.StatusCode);
        Assert.Equal("HORARIO_OCUPADO", (await JsonAsync(resposta)).GetProperty("codigo").GetString());
    }

    [Fact]
    public async Task EspecialSegueOLimiteDaVaga()
    {
        var (_, especial) = await NormalEEspecialNaQuarta0810Async();
        await SolicitarAsync(await PublicadorAsync("Ana"), especial, Quarta, Turno0810);
        await SolicitarAsync(await PublicadorAsync("Bia"), especial, Quarta, Turno0810);

        var resposta = await SolicitarAsync(await PublicadorAsync("Caio"), especial, Quarta, Turno0810);

        Assert.Equal(HttpStatusCode.Conflict, resposta.StatusCode);
        Assert.Equal("VAGA_CHEIA", (await JsonAsync(resposta)).GetProperty("codigo").GetString());
    }

    [Fact]
    public async Task EspecialTrazONomeDeQuemEstaNaVaga_SemMisturarComONormal()
    {
        var (normal, especial) = await NormalEEspecialNaQuarta0810Async();
        await SolicitarAsync(await PublicadorAsync("Ana Lima"), especial, Quarta, Turno0810);
        await SolicitarAsync(await PublicadorAsync("Bia"), normal, Quarta, Turno0810);

        var carrinhos = await (await PublicadorAsync("Leitor")).GetFromJsonAsync<JsonElement>("/api/carrinhos");
        var nomes = carrinhos.EnumerateArray().ToDictionary(
            c => c.GetProperty("id").GetInt32(),
            c => c.GetProperty("disponibilidades")[0].GetProperty("nomes").EnumerateArray().Select(n => n.GetString()).ToArray());

        Assert.Equal(["Ana"], nomes[especial]);
        Assert.Equal(["Bia"], nomes[normal]);
    }

    [Fact]
    public async Task EspecialDeOutroMes_NaoApareceParaOPublicador_EEhRecusado()
    {
        var admin = await AdminAsync();
        var doMes = await CriarCarrinhoEspecialAsync(admin, QuartaDeOutubro, "Evento de outubro");
        var deOutroMes = await CriarCarrinhoEspecialAsync(admin, QuartaDeNovembro, "Evento de novembro");
        await DefinirTurnosAsync(admin, doMes, (Quarta, Turno0810));
        await DefinirTurnosAsync(admin, deOutroMes, (Quarta, Turno0810));

        var carrinhos = await (await PublicadorAsync("Leitor")).GetFromJsonAsync<JsonElement>("/api/carrinhos");
        var unico = Assert.Single(carrinhos.EnumerateArray());
        Assert.Equal(doMes, unico.GetProperty("id").GetInt32());
        Assert.Equal(QuartaDeOutubro, unico.GetProperty("dataEspecial").GetString());

        var resposta = await SolicitarAsync(await PublicadorAsync(), deOutroMes, Quarta, Turno0810);
        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
    }

    [Fact]
    public async Task TurnosDoEspecial_SoNoDiaDaSemanaDaData()
    {
        var admin = await AdminAsync();
        var especial = await CriarCarrinhoEspecialAsync(admin, QuartaDeOutubro);

        var resposta = await DefinirTurnosAsync(admin, especial, (Quarta, Turno0810), (Quinta, Turno0810));

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
    }

    [Fact]
    public async Task DataNoFimDeSemana_Retorna400()
    {
        var admin = await AdminAsync();

        var resposta = await admin.PostAsJsonAsync("/api/admin/carrinhos", new { nome = "Evento", descricao = (string?)null, dataEspecial = "2026-10-17" });

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
    }

    [Fact]
    public async Task MudarADataDeDia_RemoveOsTurnosDosOutrosDias_SemTocarNosPedidos()
    {
        var admin = await AdminAsync();
        var carrinho = await CriarCarrinhoAsync(admin);
        await DefinirTurnosAsync(admin, carrinho, (Quarta, Turno0810), (Quinta, Turno0810));
        await SolicitarAsync(await PublicadorAsync(), carrinho, Quinta, Turno0810);

        var resposta = await admin.PutAsJsonAsync($"/api/admin/carrinhos/{carrinho}", new
        {
            nome = "Carrinho 01",
            descricao = (string?)null,
            ativo = true,
            dataEspecial = QuartaDeOutubro,
        });

        resposta.EnsureSuccessStatusCode();
        var corpo = await JsonAsync(resposta);
        Assert.Equal(QuartaDeOutubro, corpo.GetProperty("dataEspecial").GetString());
        (int, int)[] esperado = [(Quarta, Turno0810)];
        Assert.Equal(esperado, Disponibilidades(corpo));
        Assert.Single(PedidosDaGrade(await GradeAsync(admin)));
    }

    [Fact]
    public async Task Grade_MostraOEspecialSoNoMesDaData_ComAData()
    {
        var (_, especial) = await NormalEEspecialNaQuarta0810Async();
        var admin = await AdminAsync();

        var outubro = (await GradeAsync(admin)).GetProperty("celulas").EnumerateArray()
            .Where(c => c.GetProperty("carrinhoId").GetInt32() == especial)
            .ToArray();
        var novembro = (await GradeAsync(admin, "2026-11")).GetProperty("celulas").EnumerateArray()
            .Where(c => c.GetProperty("carrinhoId").GetInt32() == especial);

        var celula = Assert.Single(outubro);
        Assert.Equal(QuartaDeOutubro, celula.GetProperty("carrinhoDataEspecial").GetString());
        Assert.Empty(novembro);
    }

    [Fact]
    public async Task Historico_TrazADataEspecialDoCarrinho()
    {
        var (normal, especial) = await NormalEEspecialNaQuarta0810Async();
        var publicador = await PublicadorAsync();
        await SolicitarAsync(publicador, normal, Quarta, Turno0810);
        await SolicitarAsync(publicador, especial, Quarta, Turno0810);

        var historico = await publicador.GetFromJsonAsync<JsonElement>("/api/solicitacoes");

        var datas = historico.EnumerateArray()
            .ToDictionary(s => s.GetProperty("carrinhoId").GetInt32(), s => s.GetProperty("carrinhoDataEspecial").GetString());
        Assert.Null(datas[normal]);
        Assert.Equal(QuartaDeOutubro, datas[especial]);
    }

    [Fact]
    public async Task PedidoMantemOGrupo_QuandoADataDoCarrinhoMuda()
    {
        var admin = await AdminAsync();
        var normal = await CriarCarrinhoAsync(admin, "Carrinho 01");
        var outro = await CriarCarrinhoAsync(admin, "Carrinho 02");
        await DefinirTurnosAsync(admin, normal, (Terca, Turno0810));
        await DefinirTurnosAsync(admin, outro, (Terca, Turno0810));
        var publicador = await PublicadorAsync();
        Assert.Equal(HttpStatusCode.Created, (await SolicitarAsync(publicador, normal, Terca, Turno0810)).StatusCode);

        // O carrinho do pedido ganha uma data especial; o pedido já feito continua no grupo dos normais.
        (await admin.PutAsJsonAsync($"/api/admin/carrinhos/{normal}", new
        {
            nome = "Carrinho 01", ativo = true, dataEspecial = "2026-10-13",
        })).EnsureSuccessStatusCode();

        var resposta = await SolicitarAsync(publicador, outro, Terca, Turno0810);

        Assert.Equal(HttpStatusCode.Conflict, resposta.StatusCode);
        Assert.Equal("HORARIO_OCUPADO", (await JsonAsync(resposta)).GetProperty("codigo").GetString());
    }

    [Fact]
    public async Task MoverParaCarrinhoDeOutroMes_Recusa()
    {
        var admin = await AdminAsync();
        var normal = await CriarCarrinhoAsync(admin, "Carrinho 01");
        await DefinirTurnosAsync(admin, normal, (Quarta, Turno0810));
        var especialDeNovembro = await CriarCarrinhoEspecialAsync(admin, QuartaDeNovembro);
        await DefinirTurnosAsync(admin, especialDeNovembro, (Quarta, Turno0810));
        var pedido = (await JsonAsync(await SolicitarAsync(await PublicadorAsync(), normal, Quarta, Turno0810)))
            .GetProperty("id").GetInt32();

        var resposta = await admin.PatchAsJsonAsync($"/api/admin/solicitacoes/{pedido}", new
        {
            carrinhoId = especialDeNovembro, diaSemana = Quarta, turnoId = Turno0810,
        });

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
    }

    [Fact]
    public async Task AdicionarManual_RecusaCarrinhoDeOutroMes_AceitaNoMesCerto()
    {
        var admin = await AdminAsync();
        var especialDeNovembro = await CriarCarrinhoEspecialAsync(admin, QuartaDeNovembro);
        await DefinirTurnosAsync(admin, especialDeNovembro, (Quarta, Turno0810));

        var deOutubro = await AdicionarRegistroAntigoPorNomeAsync(admin, especialDeNovembro, Quarta, Turno0810, "Carla");
        var deNovembro = await AdicionarRegistroAntigoPorNomeAsync(admin, especialDeNovembro, Quarta, Turno0810, "Carla", "2026-11");

        Assert.Equal(HttpStatusCode.BadRequest, deOutubro.StatusCode);
        Assert.Equal(HttpStatusCode.Created, deNovembro.StatusCode);
    }
}
