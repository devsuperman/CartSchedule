import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { RequireAdminAuth } from "./components/RequireAdminAuth";
import { useJanela } from "./hooks/useJanela";
import Login from "./routes/admin/Login";
import GestaoCarrinhos from "./routes/admin/GestaoCarrinhos";
import RevisaoEscala from "./routes/admin/RevisaoEscala";
import AdicionarSolicitacao from "./routes/admin/AdicionarSolicitacao";
import EscalaFinal from "./routes/admin/EscalaFinal";
import NovaSolicitacao from "./routes/publicador/NovaSolicitacao";
import Historico from "./routes/publicador/Historico";
import JanelaFechada from "./routes/publicador/JanelaFechada";

function mesParam(mesAlvoIso: string): string {
  return mesAlvoIso.slice(0, 7);
}

function PublicadorHome() {
  const { janela, carregando } = useJanela();

  if (carregando) {
    return <p>Carregando...</p>;
  }

  return janela?.aberta ? <NovaSolicitacao /> : <JanelaFechada />;
}

function AdminHome() {
  const { janela } = useJanela();
  const mes = janela ? mesParam(janela.mesAlvo) : undefined;

  return (
    <nav>
      <h1>Painel do administrador</h1>
      <ul>
        <li>
          <Link to="/admin/carrinhos">Gestão de carrinhos</Link>
        </li>
        {mes && (
          <>
            <li>
              <Link to={`/admin/revisao/${mes}`}>Revisão de escala ({mes})</Link>
            </li>
            <li>
              <Link to={`/admin/adicionar/${mes}`}>Adicionar solicitação ({mes})</Link>
            </li>
            <li>
              <Link to={`/admin/escalas/${mes}`}>Escala final ({mes})</Link>
            </li>
          </>
        )}
      </ul>
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<PublicadorHome />} />
          <Route path="/historico" element={<Historico />} />
          <Route path="/admin/login" element={<Login />} />
          <Route
            path="/admin"
            element={
              <RequireAdminAuth>
                <AdminHome />
              </RequireAdminAuth>
            }
          />
          <Route
            path="/admin/carrinhos"
            element={
              <RequireAdminAuth>
                <GestaoCarrinhos />
              </RequireAdminAuth>
            }
          />
          <Route
            path="/admin/revisao/:mes"
            element={
              <RequireAdminAuth>
                <RevisaoEscala />
              </RequireAdminAuth>
            }
          />
          <Route
            path="/admin/adicionar/:mes"
            element={
              <RequireAdminAuth>
                <AdicionarSolicitacao />
              </RequireAdminAuth>
            }
          />
          <Route
            path="/admin/escalas/:mes"
            element={
              <RequireAdminAuth>
                <EscalaFinal />
              </RequireAdminAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
