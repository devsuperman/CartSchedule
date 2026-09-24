import type { PropsWithChildren } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { PencilIcon } from "lucide-react";
import { useAdminAuth } from "../hooks/useAdminAuth";
import { useJanela } from "../hooks/useJanela";
import { usePublicadorToken } from "../hooks/usePublicadorToken";
import type { OrigemNome } from "../routes/publicador/Nome";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function navLinkClasses({ isActive }: { isActive: boolean }) {
  return cn(
    "border-b-[3px] border-transparent px-2.5 pb-[0.7rem] pt-2 text-[0.95rem] font-semibold text-secondary-foreground/70 no-underline transition-colors hover:text-secondary-foreground focus-visible:shadow-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent",
    isActive && "border-accent text-secondary-foreground",
  );
}

/** "Olá, {primeiro nome}" no canto do cabeçalho do publicador; tocar abre a edição do nome
 * (rota /nome), que depois volta para a tela atual. Some sem nome e na própria /nome. */
function Saudacao() {
  const { nome } = usePublicadorToken();
  const { pathname } = useLocation();
  const primeiroNome = nome.trim().split(/\s+/)[0];

  if (!primeiroNome || pathname === "/nome") return null;

  const origem: OrigemNome = { de: pathname };
  return (
    <Link
      to="/nome"
      state={origem}
      aria-label={`Olá, ${primeiroNome}. Alterar nome`}
      className="mb-[0.55rem] ml-auto flex max-w-[45%] items-center gap-1.5 rounded-md px-2 py-1 text-[0.95rem] font-semibold text-secondary-foreground/90 underline decoration-secondary-foreground/40 underline-offset-4 hover:bg-secondary-foreground/10 hover:text-secondary-foreground focus-visible:ring-2 focus-visible:ring-accent"
    >
      <span className="truncate">Olá, {primeiroNome}</span>
      <PencilIcon aria-hidden className="size-3.5 shrink-0" />
    </Link>
  );
}

function Navegacao({ admin }: { admin: boolean }) {
  const { janela } = useJanela();
  const { logout } = useAdminAuth();
  const navigate = useNavigate();
  const mes = janela?.mesAlvo.slice(0, 7);

  // O publicador não tem menu: todas as telas dele já levam de volta ao início, e o título
  // "Escala TPL" também é um link para lá.
  if (!admin) {
    return (
      <div className="flex flex-1 items-end">
        <Saudacao />
      </div>
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
          <Link
            to={admin ? "/admin" : "/"}
            className="rounded-sm pb-3 text-[1.15rem] font-bold text-secondary-foreground no-underline focus-visible:ring-2 focus-visible:ring-accent"
          >
            Escala TPL
          </Link>
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
