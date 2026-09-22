import type { PropsWithChildren } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAdminAuth } from "../hooks/useAdminAuth";
import { useJanela } from "../hooks/useJanela";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function navLinkClasses({ isActive }: { isActive: boolean }) {
  return cn(
    "border-b-[3px] border-transparent px-2.5 pb-[0.7rem] pt-2 text-[0.95rem] font-semibold text-secondary-foreground/70 no-underline transition-colors hover:text-secondary-foreground focus-visible:shadow-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent",
    isActive && "border-accent text-secondary-foreground",
  );
}

function Navegacao({ admin }: { admin: boolean }) {
  const { janela } = useJanela();
  const { logout } = useAdminAuth();
  const navigate = useNavigate();
  const mes = janela?.mesAlvo.slice(0, 7);

  if (!admin) {
    return (
      <nav
        className="flex flex-1 flex-wrap items-end gap-1"
        aria-label="Principal"
      >
        <NavLink to="/" end className={navLinkClasses}>
          Solicitar
        </NavLink>
        <NavLink to="/historico" className={navLinkClasses}>
          Meu histórico
        </NavLink>
      </nav>
    );
  }

  return (
    <nav
      className="flex flex-1 flex-wrap items-end gap-1"
      aria-label="Administração"
    >
      <NavLink to="/admin" end className={navLinkClasses}>
        Início
      </NavLink>
      <NavLink to="/admin/carrinhos" className={navLinkClasses}>
        Carrinhos
      </NavLink>
      {mes && (
        <>
          <NavLink to={`/admin/revisao/${mes}`} className={navLinkClasses}>
            Revisão
          </NavLink>
          <NavLink to={`/admin/adicionar/${mes}`} className={navLinkClasses}>
            Adicionar
          </NavLink>
          <NavLink to={`/admin/escalas/${mes}`} className={navLinkClasses}>
            Escala final
          </NavLink>
        </>
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mb-[0.4rem] ml-auto border border-secondary-foreground/30 text-secondary-foreground/80 hover:bg-secondary-foreground/10 hover:text-secondary-foreground"
        onClick={() => {
          logout();
          navigate("/admin/login", { replace: true });
        }}
      >
        Sair
      </Button>
    </nav>
  );
}

export function Layout({ children }: PropsWithChildren) {
  const { pathname } = useLocation();
  const admin = pathname.startsWith("/admin") && pathname !== "/admin/login";

  return (
    <div className="flex min-h-screen flex-col">
      <a
        className="absolute left-4 -top-16 z-10 rounded-md bg-card px-4 py-2 focus:top-2"
        href="#conteudo"
      >
        Ir para o conteúdo
      </a>
      <header className="bg-secondary text-secondary-foreground">
        <div className="mx-auto flex max-w-4xl flex-wrap items-end gap-x-8 px-4 pt-3">
          <span className="pb-3 text-[1.15rem] font-bold">CartSchedule</span>
          <Navegacao admin={admin} />
        </div>
      </header>
      <main
        id="conteudo"
        className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 pt-6 pb-12 sm:pt-8"
      >
        {children}
      </main>
    </div>
  );
}
