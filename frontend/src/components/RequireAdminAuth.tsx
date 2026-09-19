import type { ReactElement } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAdminAuth } from "../hooks/useAdminAuth";

/** Guarda de rota para /admin/* — usada por cada tela do painel administrativo. */
export function RequireAdminAuth({ children }: { children: ReactElement }): ReactElement {
  const { estaAutenticado } = useAdminAuth();
  const location = useLocation();

  if (!estaAutenticado) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }

  return children;
}
