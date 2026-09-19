export const PUBLICADOR_TOKEN_STORAGE_KEY = "cartschedule:publicadorToken";
export const PUBLICADOR_NOME_STORAGE_KEY = "cartschedule:publicadorNome";
export const ADMIN_TOKEN_SESSION_KEY = "cartschedule:adminToken";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "";

function lerAdminTokenSalvo(): string | null {
  try {
    return sessionStorage.getItem(ADMIN_TOKEN_SESSION_KEY);
  } catch {
    return null;
  }
}

// Inicializado direto do sessionStorage (não de um useEffect) para que o token já
// esteja disponível na primeira requisição de uma tela protegida, mesmo antes do
// efeito de sincronização de useAdminAuth rodar (efeitos de componentes filhos
// disparam antes dos do pai no mount).
let adminToken: string | null = lerAdminTokenSalvo();

/** Guarda o JWT do administrador em memória (nunca em localStorage). */
export function setAdminToken(token: string | null): void {
  adminToken = token;
}

function getPublicadorToken(): string | null {
  try {
    return localStorage.getItem(PUBLICADOR_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

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

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  const publicadorToken = getPublicadorToken();
  if (publicadorToken) {
    headers.set("X-Publicador-Token", publicadorToken);
  }

  if (adminToken) {
    headers.set("Authorization", `Bearer ${adminToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  if (!response.ok) {
    const problem = await response.json().catch(() => null);
    throw new ApiError(response.status, problem?.title ?? response.statusText, problem);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
