import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { RequireAdminAuth } from "./components/RequireAdminAuth";
import Login from "./routes/admin/Login";

// Rotas placeholder da Fase 0 — cada tela real (routes/publicador/*, routes/admin/*)
// é adicionada por sua própria tarefa do TASKS.md, uma linha por vez neste arquivo.
function PublicadorPlaceholder() {
  return <p>Área do publicador.</p>;
}

function AdminPlaceholder() {
  return <p>Área do administrador.</p>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<PublicadorPlaceholder />} />
          <Route path="/admin/login" element={<Login />} />
          <Route
            path="/admin"
            element={
              <RequireAdminAuth>
                <AdminPlaceholder />
              </RequireAdminAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
