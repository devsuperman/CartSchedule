import { useEffect, type ReactElement } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { renovarUmaVez } from "../api/renovacao";
import { ehAdministrativo } from "../api/sessao";
import { useSessao } from "../hooks/useSessao";

/**
 * Guarda de todas as rotas, menos /login (issue #49). Sem sessão (ou depois de um 401 da API) →
 * /login, voltando à página pedida depois de entrar. `admin`: a área /admin/* exige
 * administrador ou o administrador de recuperação; o publicador comum volta ao início. O
 * administrador de recuperação não pede vagas: nas telas do publicador vai à administração.
 */
export function ExigeLogin({ children, admin = false }: { children: ReactElement; admin?: boolean }): ReactElement {
  const { sessao } = useSessao();
  const location = useLocation();
  const papel = sessao?.papel;

  useEffect(() => {
    if (papel) renovarUmaVez(papel);
  }, [papel]);

  if (!sessao) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (admin && !ehAdministrativo(sessao.papel)) {
    return <Navigate to="/" replace />;
  }

  if (!admin && sessao.papel === "recuperacao") {
    return <Navigate to="/admin" replace />;
  }

  return children;
}
