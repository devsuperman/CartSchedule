using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

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
        var resposta = await client.PostAsJsonAsync("/api/admin/login", new
        {
            usuario = ApiFixture.AdminUsuario,
            senha = ApiFixture.AdminSenha,
        });
        resposta.EnsureSuccessStatusCode();
        var token = (await resposta.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
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

    protected static Task<HttpResponseMessage> DefinirTurnosAsync(
        HttpClient admin, int carrinhoId, params (int Dia, int Turno)[] disponibilidades) =>
        admin.PutAsJsonAsync($"/api/admin/carrinhos/{carrinhoId}/turnos", new
        {
            disponibilidades = disponibilidades.Select(d => new { diaSemana = d.Dia, turnoId = d.Turno }),
        });

    protected static Task<HttpResponseMessage> SolicitarAsync(
        HttpClient publicador, int carrinhoId, int dia, int turno, string nome = "Ana") =>
        publicador.PostAsJsonAsync("/api/solicitacoes", new { nome, carrinhoId, diaSemana = dia, turnoId = turno });

    protected static Task<HttpResponseMessage> AdicionarManualAsync(
        HttpClient admin, int carrinhoId, int dia, int turno, string nome, string mes = MesAlvo) =>
        admin.PostAsJsonAsync($"/api/admin/escalas/{mes}/solicitacoes", new { nome, carrinhoId, diaSemana = dia, turnoId = turno });

    protected static async Task<JsonElement> JsonAsync(HttpResponseMessage resposta) =>
        await resposta.Content.ReadFromJsonAsync<JsonElement>();

    /// <summary>Pares (dia, turno) de um array JSON "disponibilidades", na ordem em que vieram.</summary>
    protected static (int Dia, int Turno)[] Disponibilidades(JsonElement elemento) =>
        elemento.GetProperty("disponibilidades").EnumerateArray()
            .Select(d => (d.GetProperty("diaSemana").GetInt32(), d.GetProperty("turnoId").GetInt32()))
            .ToArray();
}
