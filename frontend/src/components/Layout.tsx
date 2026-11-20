import { useEffect, useRef, useState, type PropsWithChildren } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { ChevronDownIcon, MenuIcon, XIcon } from "lucide-react";
import { apiFetch } from "../api/client";
import { useSessao } from "../hooks/useSessao";
import { useJanela } from "../hooks/useJanela";
import { useTelaLarga } from "../hooks/useTelaLarga";
import { Button } from "@/components/ui/button";
import { TrocarPin } from "./TrocarPin";
import { cn } from "@/lib/utils";

function navLinkClasses({ isActive }: { isActive: boolean }) {
  return cn(
    "border-b-[3px] border-transparent px-2.5 pb-[0.7rem] pt-2 text-[0.95rem] font-semibold text-secondary-foreground/70 no-underline transition-colors hover:text-secondary-foreground focus-visible:shadow-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent",
    isActive && "border-accent text-secondary-foreground",
  );
}

/** Contrato de GET /api/eu. */
interface Eu {
  id: string;
  nome: string;
  usuario: string | null;
  administrador: boolean;
}

/** Dados da conta logada para o cabeçalho; o administrador de recuperação não é publicador. */
function useEu(): Eu | null {
  const { sessao } = useSessao();
  const [eu, setEu] = useState<Eu | null>(null);
  const token = sessao?.papel === "recuperacao" ? null : sessao?.token;
  const logado = Boolean(token);

  useEffect(() => {
    if (!logado) return;
    let cancelado = false;
    apiFetch<Eu>("/api/eu")
      .then((dados) => {
        if (!cancelado) setEu(dados);
      })
      .catch(() => {
        // Sem a saudação o site continua funcionando; um 401 já encerrou a sessão (apiFetch).
      });
    return () => {
      cancelado = true;
      // Saiu: o próximo login (talvez de outra pessoa) não herda o nome.
      setEu(null);
    };
  }, [logado]);

  return logado ? eu : null;
}

/**
 * Canto do cabeçalho do publicador: link "Administração" (só para administradores) e o menu
 * "Olá, {primeiro nome}" com "Trocar PIN" e "Sair". Sem edição de nome: só o administrador altera.
 */
function MenuDoPublicador() {
  const eu = useEu();
  const { sair } = useSessao();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [aberto, setAberto] = useState(false);
  const [trocandoPin, setTrocandoPin] = useState(false);
  const botao = useRef<HTMLButtonElement>(null);
  const primeiroNome = eu?.nome.trim().split(/\s+/)[0];

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

  if (!eu || !primeiroNome || pathname === "/login") return null;

  function encerrar() {
    setAberto(false);
    sair();
    navigate("/login", { replace: true });
  }

  return (
    <div className="relative mb-[0.55rem] ml-auto flex min-w-0 items-center gap-1">
      {eu.administrador && (
        <Link
          to="/admin"
          className="shrink-0 rounded-md px-2 py-1 text-[0.95rem] font-semibold text-secondary-foreground/90 underline decoration-secondary-foreground/40 underline-offset-4 hover:bg-secondary-foreground/10 hover:text-secondary-foreground focus-visible:ring-2 focus-visible:ring-accent"
        >
          Administração
        </Link>
      )}
      <button
        ref={botao}
        type="button"
        aria-expanded={aberto}
        aria-controls="menu-publicador"
        onClick={() => setAberto((atual) => !atual)}
        className="flex min-w-0 items-center gap-1 rounded-md px-2 py-1 text-[0.95rem] font-semibold text-secondary-foreground/90 hover:bg-secondary-foreground/10 hover:text-secondary-foreground focus-visible:ring-2 focus-visible:ring-accent"
      >
        <span className="truncate">Olá, {primeiroNome}</span>
        <ChevronDownIcon aria-hidden className="size-4 shrink-0" />
      </button>
      {aberto && (
        <ul
          id="menu-publicador"
          className="absolute right-0 top-full z-20 mt-1 min-w-40 list-none rounded-md border border-border bg-card p-1 text-card-foreground shadow-md"
        >
          <li>
            <button
              type="button"
              onClick={() => {
                setAberto(false);
                setTrocandoPin(true);
              }}
              className="flex min-h-11 w-full items-center rounded-sm px-3 text-left text-[1rem] font-semibold hover:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
            >
              Trocar PIN
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={encerrar}
              className="flex min-h-11 w-full items-center rounded-sm px-3 text-left text-[1rem] font-semibold hover:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
            >
              Sair
            </button>
          </li>
        </ul>
      )}
      <TrocarPin aberto={trocandoPin} onFechar={() => setTrocandoPin(false)} />
    </div>
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
      // min-w-0: o menu "Olá" ocupa todo o espaço até o título e só corta ("…") se não couber.
      <div className="flex min-w-0 flex-1 items-end">
        <MenuDoPublicador />
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
  const { sessao, sair: encerrarSessao } = useSessao();
  const navigate = useNavigate();
  const mes = janela?.mesAlvo.slice(0, 7);

  const links: LinkAdmin[] = [
    { to: "/admin", rotulo: "Início", end: true },
    { to: "/admin/carrinhos", rotulo: "Carrinhos" },
    { to: "/admin/publicadores", rotulo: "Publicadores" },
    ...(mes ? [{ to: `/admin/escalas/${mes}`, rotulo: "Escala" }] : []),
    // O administrador também é publicador e pede vagas; o de recuperação não.
    ...(sessao?.papel === "administrador" ? [{ to: "/", rotulo: "Meus pedidos", end: true }] : []),
  ];

  function sair() {
    encerrarSessao();
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
