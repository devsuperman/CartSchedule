import { useCallback, useEffect, useState } from "react";
import { setAdminToken } from "../api/client";

const ADMIN_TOKEN_SESSION_KEY = "cartschedule:adminToken";

function lerTokenSalvo(): string | null {
  try {
    return sessionStorage.getItem(ADMIN_TOKEN_SESSION_KEY);
  } catch {
    return null;
  }
}

/** Guarda o JWT do administrador em sessionStorage e mantém api/client.ts sincronizado. */
export function useAdminAuth() {
  const [token, setToken] = useState<string | null>(lerTokenSalvo);

  useEffect(() => {
    setAdminToken(token);
  }, [token]);

  const login = useCallback((novoToken: string) => {
    setToken(novoToken);
    try {
      sessionStorage.setItem(ADMIN_TOKEN_SESSION_KEY, novoToken);
    } catch {
      // sessionStorage indisponível — token segue válido só em memória, até recarregar a página.
    }
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    try {
      sessionStorage.removeItem(ADMIN_TOKEN_SESSION_KEY);
    } catch {
      // ignorado
    }
  }, []);

  return { estaAutenticado: token !== null, login, logout };
}
