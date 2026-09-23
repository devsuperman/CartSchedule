import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { RequireAdminAuth } from "./components/RequireAdminAuth";
import { useJanela } from "./hooks/useJanela";
import { formatarMes } from "./utils/formatacao";
import { Card } from "@/components/ui/card";
import Login from "./routes/admin/Login";
import GestaoCarrinhos from "./routes/admin/GestaoCarrinhos";
import RevisaoEscala from "./routes/admin/RevisaoEscala";
import AdicionarSolicitacao from "./routes/admin/AdicionarSolicitacao";
import EscalaFinal from "./routes/admin/EscalaFinal";
import InicioPublicador from "./routes/publicador/InicioPublicador";
import SolicitarEscala from "./routes/publicador/SolicitarEscala";

function mesParam(mesAlvoIso: string): string {
  return mesAlvoIso.slice(0, 7);
}

function AdminHome() {
  const { janela } = useJanela();
  const mes = janela ? mesParam(janela.mesAlvo) : undefined;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <h1>Painel do administrador</h1>
        {mes && (
          <p className="text-muted-foreground">
            Escala em andamento: {formatarMes(mes)}.
          </p>
        )}
      </div>
      <ul className="grid list-none grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-3 p-0">
        <li>
          <Link to="/admin/carrinhos" className="block h-full no-underline">
            <Card className="h-full gap-1 transition-colors hover:border-primary">
              <strong className="text-[1.1rem] font-bold text-primary">Carrinhos</strong>
              <span className="text-[0.95rem] font-normal text-muted-foreground">
                Cadastre carrinhos e escolha os turnos de cada um.
              </span>
            </Card>
          </Link>
        </li>
        {mes && (
          <>
            <li>
              <Link to={`/admin/revisao/${mes}`} className="block h-full no-underline">
                <Card className="h-full gap-1 transition-colors hover:border-primary">
                  <strong className="text-[1.1rem] font-bold text-primary">Revisão da escala</strong>
                  <span className="text-[0.95rem] font-normal text-muted-foreground">
                    Aprove ou rejeite os pedidos recebidos.
                  </span>
                </Card>
              </Link>
            </li>
            <li>
              <Link to={`/admin/adicionar/${mes}`} className="block h-full no-underline">
                <Card className="h-full gap-1 transition-colors hover:border-primary">
                  <strong className="text-[1.1rem] font-bold text-primary">Adicionar solicitação</strong>
                  <span className="text-[0.95rem] font-normal text-muted-foreground">
                    Inclua alguém direto na escala, já aprovado.
                  </span>
                </Card>
              </Link>
            </li>
            <li>
              <Link to={`/admin/escalas/${mes}`} className="block h-full no-underline">
                <Card className="h-full gap-1 transition-colors hover:border-primary">
                  <strong className="text-[1.1rem] font-bold text-primary">Escala final</strong>
                  <span className="text-[0.95rem] font-normal text-muted-foreground">
                    Veja quem trabalha em cada carrinho, dia e turno.
                  </span>
                </Card>
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
          <Route path="/" element={<InicioPublicador />} />
          <Route path="/solicitar" element={<SolicitarEscala />} />
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
