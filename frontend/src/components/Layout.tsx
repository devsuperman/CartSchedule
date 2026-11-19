import { useEffect, useRef, useState, type PropsWithChildren } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { MenuIcon, PencilIcon, XIcon } from "lucide-react";
import { useAdminAuth } from "../hooks/useAdminAuth";
import { useJanela } from "../hooks/useJanela";
import { useTelaLarga } from "../hooks/useTelaLarga";
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

  if (!primeiroNome || pathname === "/nome" || pathname === "/login") return null;

  const origem: OrigemNome = { de: pathname };
  return (
    <Link
      to="/nome"
      state={origem}
      aria-label={`Olá, ${primeiroNome}. Alterar nome`}
      className="mb-[0.55rem] ml-auto flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1 text-[0.95rem] font-semibold text-secondary-foreground/90 underline decoration-secondary-foreground/40 underline-offset-4 hover:bg-secondary-foreground/10 hover:text-secondary-foreground focus-visible:ring-2 focus-visible:ring-accent"
    >
      <span className="truncate">Olá, {primeiroNome}</span>
      <PencilIcon aria-hidden className="size-3.5 shrink-0" />
    </Link>
  );
}

interface LinkAdmin {
  to: string;
  rotulo: string;
  end?: boolean;
}

function Navegacao({ admin }: { admin: boolean }) {
  // O publicador não tem menu: todas as telas dele já levam de volta ao início, e o título
  // "Escala TPL" também é um link para lá.
  if (!admin) {
    return (
      // min-w-0: a saudação ocupa todo o espaço até o título e só corta ("…") se não couber.
      <div className="flex min-w-0 flex-1 items-end">
        <Saudacao />
      </div>
    );
  }

  return <NavegacaoAdmin />;
}

/**
 * Menu do administrador. No tablet/computador os links ficam à vista no cabeçalho; no celular
 * ficam atrás do botão "Menu", um por linha (alvos de toque grandes), com "Sair" por último.
 */
function NavegacaoAdmin() {
  const telaLarga = useTelaLarga();
  const { janela } = useJanela();
  const { logout } = useAdminAuth();
  const navigate = useNavigate();
  const mes = janela?.mesAlvo.slice(0, 7);

  const links: LinkAdmin[] = [
    { to: "/admin", rotulo: "Início", end: true },
    { to: "/admin/carrinhos", rotulo: "Carrinhos" },
    { to: "/admin/publicadores", rotulo: "Publicadores" },
    ...(mes ? [{ to: `/admin/escalas/${mes}`, rotulo: "Escala" }] : []),
  ];

  function sair() {
    logout();
    navigate("/login", { replace: true });
  }

  if (!telaLarga) {
    return <MenuCelular links={links} onSair={sair} />;
  }

  return (
    <nav className="flex flex-1 flex-wrap items-end gap-1" aria-label="Administração">
      {links.map((link) => (
        <NavLink key={link.to} to={link.to} end={link.end} className={navLinkClasses}>
          {link.rotulo}
        </NavLink>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mb-[0.4rem] ml-auto border border-secondary-foreground/30 text-secondary-foreground/80 hover:bg-secondary-foreground/10 hover:text-secondary-foreground"
        onClick={sair}
      >
        Sair
      </Button>
    </nav>
  );
}

function menuLinkClasses({ isActive }: { isActive: boolean }) {
  return cn(
    "flex min-h-12 items-center rounded-md border-l-[3px] border-transparent px-3 text-[1rem] font-semibold text-secondary-foreground/80 no-underline hover:bg-secondary-foreground/10 hover:text-secondary-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent",
    isActive && "border-accent bg-secondary-foreground/10 text-secondary-foreground",
  );
}

function MenuCelular({ links, onSair }: { links: LinkAdmin[]; onSair: () => void }) {
  const [aberto, setAberto] = useState(false);
  const botao = useRef<HTMLButtonElement>(null);

  // Esc fecha e devolve o foco ao botão (teclado externo / leitor de tela).
  useEffect(() => {
    if (!aberto) return;
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") {
        setAberto(false);
        botao.current?.focus();
      }
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aberto]);

  return (
    <>
      <Button
        ref={botao}
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Menu"
        aria-expanded={aberto}
        aria-controls="menu-administracao"
        className="mb-[0.55rem] ml-auto border [&_svg]:size-6 border-secondary-foreground/30 text-secondary-foreground/90 hover:bg-secondary-foreground/10 hover:text-secondary-foreground"
        onClick={() => setAberto((atual) => !atual)}
      >
        {aberto ? <XIcon aria-hidden /> : <MenuIcon aria-hidden />}
      </Button>
      {aberto && (
        // basis-full: o menu ocupa uma linha inteira abaixo do título e do botão.
        <nav id="menu-administracao" aria-label="Administração" className="basis-full pb-3">
          <ul className="flex list-none flex-col gap-1 p-0">
            {links.map((link) => (
              <li key={link.to}>
                <NavLink to={link.to} end={link.end} className={menuLinkClasses} onClick={() => setAberto(false)}>
                  {link.rotulo}
                </NavLink>
              </li>
            ))}
            <li className="mt-2 border-t border-secondary-foreground/20 pt-2">
              <button
                type="button"
                className="flex min-h-12 w-full items-center rounded-md px-3 text-left text-[1rem] font-semibold text-secondary-foreground/80 hover:bg-secondary-foreground/10 hover:text-secondary-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
                onClick={onSair}
              >
                Sair
              </button>
            </li>
          </ul>
        </nav>
      )}
    </>
  );
}

export function Layout({ children }: PropsWithChildren) {
  const { pathname } = useLocation();
  const admin = pathname.startsWith("/admin");

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
