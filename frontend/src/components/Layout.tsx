import type { PropsWithChildren } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAdminAuth } from "../hooks/useAdminAuth";
import { useJanela } from "../hooks/useJanela";

function Navegacao({ admin }: { admin: boolean }) {
  const { janela } = useJanela();
  const { logout } = useAdminAuth();
  const navigate = useNavigate();
  const mes = janela?.mesAlvo.slice(0, 7);

  if (!admin) {
    return (
      <nav className="app-nav" aria-label="Principal">
        <NavLink to="/" end>
          Solicitar
        </NavLink>
        <NavLink to="/historico">Meu histórico</NavLink>
      </nav>
    );
  }

  return (
    <nav className="app-nav" aria-label="Administração">
      <NavLink to="/admin" end>
        Início
      </NavLink>
      <NavLink to="/admin/carrinhos">Carrinhos</NavLink>
      {mes && (
        <>
          <NavLink to={`/admin/revisao/${mes}`}>Revisão</NavLink>
          <NavLink to={`/admin/adicionar/${mes}`}>Adicionar</NavLink>
          <NavLink to={`/admin/escalas/${mes}`}>Escala final</NavLink>
        </>
      )}
      <button
        type="button"
        className="app-nav__sair"
        onClick={() => {
          logout();
          navigate("/admin/login", { replace: true });
        }}
      >
        Sair
      </button>
    </nav>
  );
}

export function Layout({ children }: PropsWithChildren) {
  const { pathname } = useLocation();
  const admin = pathname.startsWith("/admin") && pathname !== "/admin/login";

  return (
    <div className="app-layout">
      <a className="pular-conteudo" href="#conteudo">
        Ir para o conteúdo
      </a>
      <header className="app-header">
        <div className="app-header__inner">
          <span className="app-header__title">CartSchedule</span>
          <Navegacao admin={admin} />
        </div>
      </header>
      <main id="conteudo" className="app-content">
        {children}
      </main>
    </div>
  );
}
