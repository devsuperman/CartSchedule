import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, ApiError, codigoDoErro } from "./client";
import { iniciarSessao, obterSessao, SESSAO_STORAGE_KEY } from "./sessao";

function respostaHttp(status: number, corpo: unknown = null): Response {
  return new Response(corpo === null ? null : JSON.stringify(corpo), { status });
}

beforeEach(() => {
  iniciarSessao({ token: "token-antigo", papel: "publicador" });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiFetch — sessão", () => {
  it("manda o token da sessão no Authorization, sem o token anônimo do aparelho", async () => {
    const fetch = vi.fn().mockResolvedValue(respostaHttp(200, []));
    vi.stubGlobal("fetch", fetch);

    await apiFetch("/api/solicitacoes");

    const headers = fetch.mock.calls[0][1].headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer token-antigo");
    expect(headers.has("X-Publicador-Token")).toBe(false);
  });

  it("guarda a sessão no localStorage, para durar entre aberturas do app", () => {
    expect(JSON.parse(localStorage.getItem(SESSAO_STORAGE_KEY)!)).toEqual({ token: "token-antigo", papel: "publicador" });
  });

  it.each(["/api/solicitacoes", "/api/admin/carrinhos"])("token recusado (401) em %s encerra a sessão", async (rota) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respostaHttp(401)));

    await expect(apiFetch(rota)).rejects.toBeInstanceOf(ApiError);

    expect(obterSessao()).toBeNull();
    expect(localStorage.getItem(SESSAO_STORAGE_KEY)).toBeNull();
  });

  it("erro de login (401) não mexe na sessão: a tela mostra a mensagem", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respostaHttp(401, { codigo: "CREDENCIAIS_INVALIDAS" })));

    await expect(apiFetch("/api/login", { method: "POST", body: "{}" })).rejects.toBeInstanceOf(ApiError);

    expect(obterSessao()?.token).toBe("token-antigo");
  });

  it.each([403, 409])("outros erros (%i) mantêm a sessão", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respostaHttp(status, { codigo: "X" })));

    await expect(apiFetch("/api/admin/publicadores", { method: "POST", body: "{}" })).rejects.toBeInstanceOf(ApiError);

    expect(obterSessao()?.token).toBe("token-antigo");
  });
});

describe("codigoDoErro", () => {
  it("lê o codigo do ProblemDetails de um erro da API", () => {
    expect(codigoDoErro(new ApiError(409, "Cheia", { codigo: "VAGA_CHEIA" }))).toBe("VAGA_CHEIA");
  });

  it("é undefined sem código ou fora de um erro da API", () => {
    expect(codigoDoErro(new ApiError(400, "Inválido", { title: "Inválido" }))).toBeUndefined();
    expect(codigoDoErro(new ApiError(500, "Erro", null))).toBeUndefined();
    expect(codigoDoErro(new Error("rede"))).toBeUndefined();
  });
});
