import { useSyncExternalStore } from "react";
import { assinarSessao, encerrarSessao, iniciarSessao, obterSessao } from "../api/sessao";

/** Sessão de login atual (api/sessao.ts); `entrar` guarda o token do login, `sair` apaga. */
export function useSessao() {
  const sessao = useSyncExternalStore(assinarSessao, obterSessao);
  return { sessao, entrar: iniciarSessao, sair: encerrarSessao };
}
