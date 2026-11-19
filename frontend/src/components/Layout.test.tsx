import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_TOKEN_SESSION_KEY, apiFetch, PUBLICADOR_NOME_STORAGE_KEY } from "../api/client";
import { usePublicadorToken } from "../hooks/usePublicadorToken";
import { Layout } from "./Layout";

vi.mock("../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/client")>()),
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

beforeEach(() => {
  mockApiFetch.mockReset();
  mockApiFetch.mockResolvedValue({ aberta: true, mesAlvo: "2026-10-01" });
});

function MostraEstado() {
  const location = useLocation();
  return <p>Origem: {(location.state as { de?: string } | null)?.de}</p>;
}

function TelaQueTrocaONome() {
  const { setNome } = usePublicadorToken();
  return (
    <button type="button" onClick={() => setNome("Maria Souza")}>
      Trocar nome
    </button>
  );
}

function renderizar(caminho = "/") {
  render(
    <MemoryRouter initialEntries={[caminho]}>
      <Layout>
        <Routes>
          <Route path="/" element={<TelaQueTrocaONome />} />
          <Route path="/nome" element={<MostraEstado />} />
          <Route path="/admin" element={<p>Admin</p>} />
          <Route path="/admin/carrinhos" element={<p>Tela Carrinhos</p>} />
          <Route path="/admin/publicadores" element={<p>Tela Publicadores</p>} />
          <Route path="/login" element={<p>Tela de login</p>} />
        </Routes>
      </Layout>
    </MemoryRouter>,
  );
  return userEvent.setup();
}

describe("Layout — Olá, Fulano", () => {
  it("mostra só o primeiro nome e leva à edição lembrando a tela de origem", async () => {
    localStorage.setItem(PUBLICADOR_NOME_STORAGE_KEY, "João da Silva");
    const user = renderizar();

    const link = screen.getByRole("link", { name: /Olá, João/ });
    expect(link).toHaveTextContent("Olá, João");
    expect(link).not.toHaveTextContent("Silva");

    await user.click(link);
    expect(screen.getByText("Origem: /")).toBeInTheDocument();
  });

  it("atualiza na hora quando o nome muda em outra tela", async () => {
    localStorage.setItem(PUBLICADOR_NOME_STORAGE_KEY, "Joao");
    const user = renderizar();

    await user.click(screen.getByRole("button", { name: "Trocar nome" }));

    expect(screen.getByRole("link", { name: /Olá, Maria/ })).toBeInTheDocument();
  });

  it("não aparece sem nome salvo", () => {
    renderizar();
    expect(screen.queryByRole("link", { name: /Olá/ })).not.toBeInTheDocument();
  });

  it.each(["/nome", "/admin"])("não aparece em %s", (caminho) => {
    localStorage.setItem(PUBLICADOR_NOME_STORAGE_KEY, "Ana");
    renderizar(caminho);
    expect(screen.queryByRole("link", { name: /Olá/ })).not.toBeInTheDocument();
  });

  it("o publicador não tem menu; o título leva à tela inicial", async () => {
    localStorage.setItem(PUBLICADOR_NOME_STORAGE_KEY, "Ana");
    const user = renderizar("/nome");

    expect(screen.queryByRole("link", { name: "Início" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Escala TPL" }));
    expect(screen.getByRole("button", { name: "Trocar nome" })).toBeInTheDocument();
  });
});

describe("Layout — menu do administrador", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function telaLarga() {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: true,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
  }

  it("no celular, os links ficam atrás do botão Menu, um por linha", async () => {
    const user = renderizar("/admin");

    const botao = screen.getByRole("button", { name: "Menu" });
    expect(botao).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: "Carrinhos" })).not.toBeInTheDocument();

    await user.click(botao);

    expect(botao).toHaveAttribute("aria-expanded", "true");
    const menu = screen.getByRole("navigation", { name: "Administração" });
    expect(within(menu).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "Início",
      "Carrinhos",
      "Publicadores",
      "Escala",
      "Sair",
    ]);
  });

  it("marca a tela atual no menu", async () => {
    const user = renderizar("/admin/publicadores");

    await user.click(screen.getByRole("button", { name: "Menu" }));

    expect(screen.getByRole("link", { name: "Publicadores" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Carrinhos" })).not.toHaveAttribute("aria-current");
  });

  it("escolher um link navega e fecha o menu", async () => {
    const user = renderizar("/admin");

    await user.click(screen.getByRole("button", { name: "Menu" }));
    await user.click(screen.getByRole("link", { name: "Carrinhos" }));

    expect(screen.getByText("Tela Carrinhos")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Publicadores" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Menu" })).toHaveAttribute("aria-expanded", "false");
  });

  it("Esc e um novo toque no botão fecham o menu", async () => {
    const user = renderizar("/admin");
    const botao = screen.getByRole("button", { name: "Menu" });

    await user.click(botao);
    await user.keyboard("{Escape}");
    expect(botao).toHaveAttribute("aria-expanded", "false");
    expect(botao).toHaveFocus();

    await user.click(botao);
    await user.click(botao);
    expect(screen.queryByRole("link", { name: "Carrinhos" })).not.toBeInTheDocument();
  });

  it("Sair no menu encerra a sessão e vai ao login", async () => {
    sessionStorage.setItem(ADMIN_TOKEN_SESSION_KEY, "jwt");
    const user = renderizar("/admin");

    await user.click(screen.getByRole("button", { name: "Menu" }));
    await user.click(screen.getByRole("button", { name: "Sair" }));

    expect(screen.getByText("Tela de login")).toBeInTheDocument();
    expect(sessionStorage.getItem(ADMIN_TOKEN_SESSION_KEY)).toBeNull();
  });

  it("no tablet e no computador, os links ficam à vista, sem botão Menu", () => {
    telaLarga();
    renderizar("/admin");

    expect(screen.queryByRole("button", { name: "Menu" })).not.toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Administração" });
    expect(within(nav).getByRole("link", { name: "Publicadores" })).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: "Sair" })).toBeInTheDocument();
  });

  it("o publicador continua sem menu", () => {
    renderizar("/");
    expect(screen.queryByRole("button", { name: "Menu" })).not.toBeInTheDocument();
  });
});
