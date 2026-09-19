export const PUBLICADOR_TOKEN_STORAGE_KEY = "cartschedule:publicadorToken";
export const PUBLICADOR_NOME_STORAGE_KEY = "cartschedule:publicadorNome";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "";

let adminToken: string | null = null;

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
