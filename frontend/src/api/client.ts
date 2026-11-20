import { encerrarSessao, obterSessao } from "./sessao";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "";

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

/**
 * O `codigo` que o backend põe no ProblemDetails (ex: JANELA_FECHADA, VAGA_CHEIA, PIN_FRACO).
 * As telas decidem por ele, nunca por "qualquer 400". Undefined se não é um erro da API com código.
 */
export function codigoDoErro(err: unknown): string | undefined {
  if (!(err instanceof ApiError)) return undefined;
  const codigo = (err.details as { codigo?: unknown } | null | undefined)?.codigo;
  return typeof codigo === "string" ? codigo : undefined;
}

/**
 * Chamada à API com o token da sessão em `Authorization: Bearer`. Um 401 fora do próprio login
 * (token expirado, senha redefinida, conta excluída) encerra a sessão: a guarda ExigeLogin leva
 * ao /login, lembrando a página em que a pessoa estava.
 */
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  const sessao = obterSessao();
  if (sessao) {
    headers.set("Authorization", `Bearer ${sessao.token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  if (!response.ok) {
    if (response.status === 401 && path !== "/api/login") {
      encerrarSessao();
    }
    const problem = await response.json().catch(() => null);
    throw new ApiError(response.status, problem?.title ?? response.statusText, problem);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
