using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using CartSchedule.Api.Domain;
using CartSchedule.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace CartSchedule.Api.Tests.Infraestrutura;

/// <summary>
/// Base dos testes de integração: banco limpo antes de cada teste e atalhos para os
/// fluxos que quase todo teste precisa (login do admin, criar carrinho, configurar
/// turnos). Os corpos são JSON anônimos em camelCase — o mesmo contrato que o frontend
/// usa — em vez dos records internos da API.
/// </summary>
[Collection("api")]
public abstract class ApiTestBase(ApiFixture fixture) : IAsyncLifetime
{
    protected const int Segunda = 1, Terca = 2, Quarta = 3, Quinta = 4, Sexta = 5;

    /// <summary>Ids dos turnos fixos (seed): 1 = 06–08, 2 = 08–10, 3 = 10–12, 4 = 14–16, 5 = 16–18, 6 = 18–20.</summary>
    protected const int Turno0608 = 1, Turno0810 = 2, Turno1012 = 3, Turno1416 = 4;

    protected const string MesAlvo = "2026-10";

    protected ApiFixture Fixture { get; } = fixture;

    public async ValueTask InitializeAsync() => await Fixture.LimparAsync();

    public ValueTask DisposeAsync() => ValueTask.CompletedTask;

    protected async Task<HttpClient> AdminAsync()
    {
        var client = Fixture.Factory.CreateClient();
        var resposta = await LoginAsync(client, ApiFixture.AdminUsuario, ApiFixture.AdminSenha);
        resposta.EnsureSuccessStatusCode();
        return Autenticar(client, await resposta.Content.ReadFromJsonAsync<JsonElement>());
    }

    /// <summary>POST /api/login — o mesmo endpoint para o administrador de recuperação e os publicadores.</summary>
    protected static Task<HttpResponseMessage> LoginAsync(HttpClient client, string usuario, string pin) =>
        client.PostAsJsonAsync("/api/login", new { usuario, pin });

    /// <summary>Cliente novo que manda o token da resposta de login no Authorization.</summary>
    protected HttpClient ClienteComToken(JsonElement respostaLogin) =>
        Autenticar(Fixture.Factory.CreateClient(), respostaLogin);

    private static HttpClient Autenticar(HttpClient client, JsonElement respostaLogin)
    {
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", respostaLogin.GetProperty("token").GetString());
        return client;
    }

    /// <summary>Cria um publicador com conta pela API admin; devolve o id e o PIN gerado.</summary>
    protected static async Task<(Guid Id, string Pin)> CriarContaAsync(
        HttpClient admin, string nome, string usuario, bool administrador = false, bool criancaOuIdoso = false)
    {
        var resposta = await admin.PostAsJsonAsync("/api/admin/publicadores", new { nome, usuario, criancaOuIdoso, administrador });
        Assert.Equal(System.Net.HttpStatusCode.Created, resposta.StatusCode);
        var corpo = await resposta.Content.ReadFromJsonAsync<JsonElement>();
        return (corpo.GetProperty("id").GetGuid(), corpo.GetProperty("pin").GetString()!);
    }

    protected HttpClient Publicador(Guid? token = null)
    {
        var client = Fixture.Factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Publicador-Token", (token ?? Guid.NewGuid()).ToString());
        return client;
    }

    protected async Task<int> CriarCarrinhoAsync(HttpClient admin, string nome = "Carrinho 01")
    {
        var resposta = await admin.PostAsJsonAsync("/api/admin/carrinhos", new { nome, descricao = (string?)null });
        resposta.EnsureSuccessStatusCode();
        return (await resposta.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();
    }

    /// <summary>Carrinho de data especial (PLANNING.md regra 10a), com data no formato yyyy-MM-dd.</summary>
    protected async Task<int> CriarCarrinhoEspecialAsync(HttpClient admin, string dataEspecial, string nome = "Carrinho do evento")
    {
        var resposta = await admin.PostAsJsonAsync("/api/admin/carrinhos", new { nome, descricao = (string?)null, dataEspecial });
        resposta.EnsureSuccessStatusCode();
        return (await resposta.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();
    }

    protected static Task<HttpResponseMessage> DefinirTurnosAsync(
        HttpClient admin, int carrinhoId, params (int Dia, int Turno)[] disponibilidades) =>
        admin.PutAsJsonAsync($"/api/admin/carrinhos/{carrinhoId}/turnos", new
        {
            disponibilidades = disponibilidades.Select(d => new { diaSemana = d.Dia, turnoId = d.Turno }),
        });

    protected static Task<HttpResponseMessage> SolicitarAsync(
        HttpClient publicador, int carrinhoId, int dia, int turno, string nome = "Ana") =>
        publicador.PostAsJsonAsync("/api/solicitacoes", new { nome, carrinhoId, diaSemana = dia, turnoId = turno });

    /// <summary>
    /// Atalho de teste, não uma regra da API (que só recebe o id): adiciona à vaga o registro
    /// antigo (sem usuário/PIN) com esse nome, gravado direto no banco no primeiro uso do nome
    /// no teste e reusado nos seguintes. Para os testes que só precisam de "alguém" na vaga.
    /// </summary>
    protected async Task<HttpResponseMessage> AdicionarRegistroAntigoAsync(
        HttpClient admin, int carrinhoId, int dia, int turno, string nome, string mes = MesAlvo)
    {
        Guid publicadorId;
        using (var scope = Fixture.Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            publicadorId = await db.Publicadores.Where(p => p.Nome == nome).OrderBy(p => p.Id)
                .Select(p => (Guid?)p.Id).FirstOrDefaultAsync() ?? await RegistroAntigoAsync(nome);
        }

        return await AdicionarParaAsync(admin, carrinhoId, dia, turno, publicadorId, mes);
    }

    /// <summary>POST /api/admin/escalas/{mes}/solicitacoes para um publicador já cadastrado.</summary>
    protected static Task<HttpResponseMessage> AdicionarParaAsync(
        HttpClient admin, int carrinhoId, int dia, int turno, Guid publicadorId, string mes = MesAlvo) =>
        admin.PostAsJsonAsync(
            $"/api/admin/escalas/{mes}/solicitacoes",
            new { publicadorId, carrinhoId, diaSemana = dia, turnoId = turno });

    /// <summary>
    /// Publicador sem usuário/PIN, como os registros antigos (do token anônimo do aparelho ou da
    /// antiga adição manual por nome), gravado direto no banco.
    /// </summary>
    protected async Task<Guid> RegistroAntigoAsync(string nome, bool criancaOuIdoso = false)
    {
        using var scope = Fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var publicador = new Publicador { Id = Guid.NewGuid(), Nome = nome, CriancaOuIdoso = criancaOuIdoso };
        db.Publicadores.Add(publicador);
        await db.SaveChangesAsync();
        return publicador.Id;
    }

    /// <summary>Fecha (aberto = false) ou reabre o envio dos publicadores para a escala do mês.</summary>
    protected static Task<HttpResponseMessage> AlterarEnvioAsync(HttpClient admin, bool aberto, string mes = MesAlvo) =>
        admin.PutAsJsonAsync($"/api/admin/escalas/{mes}/envio", new { aberto });

    protected static async Task<JsonElement> GradeAsync(HttpClient admin, string mes = MesAlvo) =>
        await admin.GetFromJsonAsync<JsonElement>($"/api/admin/escalas/{mes}/grade");

    /// <summary>Todos os pedidos da grade (os "publicadores" de todas as células).</summary>
    protected static JsonElement[] PedidosDaGrade(JsonElement grade) =>
        grade.GetProperty("celulas").EnumerateArray()
            .SelectMany(c => c.GetProperty("publicadores").EnumerateArray())
            .ToArray();

    protected static async Task<JsonElement> JsonAsync(HttpResponseMessage resposta) =>
        await resposta.Content.ReadFromJsonAsync<JsonElement>();

    /// <summary>Pares (dia, turno) de um array JSON "disponibilidades", na ordem em que vieram.</summary>
    protected static (int Dia, int Turno)[] Disponibilidades(JsonElement elemento) =>
        elemento.GetProperty("disponibilidades").EnumerateArray()
            .Select(d => (d.GetProperty("diaSemana").GetInt32(), d.GetProperty("turnoId").GetInt32()))
            .ToArray();
}
