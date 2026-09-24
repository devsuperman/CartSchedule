import type { ReactElement } from "react";
import { Navigate } from "react-router-dom";
import { usePublicadorToken } from "../hooks/usePublicadorToken";

/** Guarda das telas do publicador: sem nome salvo, a primeira coisa é informar o nome
 * (rota /nome) — com a janela de envio aberta ou fechada. */
export function ExigeNome({ children }: { children: ReactElement }): ReactElement {
  const { nome } = usePublicadorToken();

  if (nome.trim() === "") {
    return <Navigate to="/nome" replace />;
  }

  return children;
}
