import { useState, useSyncExternalStore } from "react";
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

// Fallback quando o localStorage está indisponível (ex: modo privado): o nome vale só em memória.
let nomeEmMemoria = "";
const ouvintes = new Set<() => void>();

function lerNomeSalvo(): string {
  try {
    return localStorage.getItem(PUBLICADOR_NOME_STORAGE_KEY) ?? "";
  } catch {
    return nomeEmMemoria;
  }
}

function assinarNome(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

function setNome(novoNome: string): void {
  nomeEmMemoria = novoNome;
  try {
    localStorage.setItem(PUBLICADOR_NOME_STORAGE_KEY, novoNome);
  } catch {
    // localStorage indisponível — segue com o valor em memória.
  }
  ouvintes.forEach((ouvinte) => ouvinte());
}

/** Identificação sem cadastro/login (PLANNING.md regra 9): GUID + nome salvos no localStorage.
 * O nome é compartilhado entre os componentes: mudar numa tela atualiza o "Olá, Fulano" do
 * cabeçalho na hora. */
export function usePublicadorToken() {
  const [token] = useState(gerarOuLerToken);
  const nome = useSyncExternalStore(assinarNome, lerNomeSalvo);

  return { token, nome, setNome };
}
