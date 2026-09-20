import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { RequireAdminAuth } from "./components/RequireAdminAuth";
import { useJanela } from "./hooks/useJanela";
import { formatarMes } from "./utils/formatacao";
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
    return <p className="carregando">Carregando…</p>;
  }

  return janela?.aberta ? <NovaSolicitacao /> : <JanelaFechada />;
}

function AdminHome() {
  const { janela } = useJanela();
  const mes = janela ? mesParam(janela.mesAlvo) : undefined;

  return (
    <section className="pilha">
      <div className="pagina-titulo">
        <h1>Painel do administrador</h1>
        {mes && <p className="subtitulo">Escala em andamento: {formatarMes(mes)}.</p>}
      </div>
      <ul className="atalhos">
        <li>
          <Link to="/admin/carrinhos">
            <strong>Carrinhos</strong>
            <span>Cadastre carrinhos e escolha os turnos de cada um.</span>
          </Link>
        </li>
        {mes && (
          <>
            <li>
              <Link to={`/admin/revisao/${mes}`}>
                <strong>Revisão da escala</strong>
                <span>Aprove ou rejeite os pedidos recebidos.</span>
              </Link>
            </li>
            <li>
              <Link to={`/admin/adicionar/${mes}`}>
                <strong>Adicionar solicitação</strong>
                <span>Inclua alguém direto na escala, já aprovado.</span>
              </Link>
            </li>
            <li>
              <Link to={`/admin/escalas/${mes}`}>
                <strong>Escala final</strong>
                <span>Veja quem trabalha em cada carrinho, dia e turno.</span>
              </Link>
            </li>
          </>
        )}
      </ul>
    </section>
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
