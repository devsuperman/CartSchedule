import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_TOKEN_SESSION_KEY, apiFetch, ApiError, setAdminToken } from "./client";

function respostaHttp(status: number, corpo: unknown = null): Response {
  return new Response(corpo === null ? null : JSON.stringify(corpo), { status });
}

const replace = vi.fn();

beforeEach(() => {
  sessionStorage.setItem(ADMIN_TOKEN_SESSION_KEY, "token-antigo");
  setAdminToken("token-antigo");
  vi.stubGlobal("location", { ...window.location, replace });
});

afterEach(() => {
  vi.unstubAllGlobals();
  replace.mockReset();
  sessionStorage.clear();
  setAdminToken(null);
});

describe("apiFetch — sessão do administrador", () => {
  it.each([401, 403])("token recusado (%i) numa rota admin encerra a sessão e leva ao /login", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respostaHttp(status, { title: "Forbidden" })));

    await expect(apiFetch("/api/admin/carrinhos")).rejects.toBeInstanceOf(ApiError);

    expect(sessionStorage.getItem(ADMIN_TOKEN_SESSION_KEY)).toBeNull();
    expect(replace).toHaveBeenCalledWith("/login");
  });

  it("erro de login (401) não redireciona: a tela mostra a mensagem", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respostaHttp(401, { codigo: "CREDENCIAIS_INVALIDAS" })));

    await expect(apiFetch("/api/login", { method: "POST", body: "{}" })).rejects.toBeInstanceOf(ApiError);

    expect(replace).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(ADMIN_TOKEN_SESSION_KEY)).toBe("token-antigo");
  });

  it("outros erros de rota admin (ex.: 409) mantêm a sessão", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respostaHttp(409, { codigo: "USUARIO_EM_USO" })));

    await expect(apiFetch("/api/admin/publicadores", { method: "POST", body: "{}" })).rejects.toBeInstanceOf(ApiError);

    expect(replace).not.toHaveBeenCalled();
  });
});
