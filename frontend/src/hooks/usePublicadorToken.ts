import { useCallback, useState } from "react";
import { PUBLICADOR_NOME_STORAGE_KEY, PUBLICADOR_TOKEN_STORAGE_KEY } from "../api/client";

function gerarOuLerToken(): string {
  try {
    const existente = localStorage.getItem(PUBLICADOR_TOKEN_STORAGE_KEY);
    if (existente) {
      return existente;
    }

    const novo = crypto.randomUUID();
    localStorage.setItem(PUBLICADOR_TOKEN_STORAGE_KEY, novo);
    return novo;
  } catch {
    return crypto.randomUUID();
  }
}

function lerNomeSalvo(): string {
  try {
    return localStorage.getItem(PUBLICADOR_NOME_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

/** Identificação sem cadastro/login (PLANNING.md regra 9): GUID + nome salvos no localStorage. */
export function usePublicadorToken() {
  const [token] = useState(gerarOuLerToken);
  const [nome, setNomeState] = useState(lerNomeSalvo);

  const setNome = useCallback((novoNome: string) => {
    setNomeState(novoNome);
    try {
      localStorage.setItem(PUBLICADOR_NOME_STORAGE_KEY, novoNome);
    } catch {
      // localStorage indisponível (ex: modo privado) — nome segue válido só em memória.
    }
  }, []);

  return { token, nome, setNome };
}
