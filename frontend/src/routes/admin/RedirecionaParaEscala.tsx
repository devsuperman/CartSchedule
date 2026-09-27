import { Navigate, useParams } from "react-router-dom";

/** As antigas telas Revisão e Adicionar viraram parte da Escala: links antigos caem nela. */
export default function RedirecionaParaEscala() {
  const { mes } = useParams<{ mes: string }>();
  return <Navigate to={mes ? `/admin/escalas/${mes}` : "/admin"} replace />;
}
