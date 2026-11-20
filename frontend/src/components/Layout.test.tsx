import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client";
import { iniciarSessao, obterSessao, type Papel } from "../api/sessao";
import { Layout } from "./Layout";

vi.mock("../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/client")>()),
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

function mockarApi({ nome = "João da Silva", administrador = false } = {}) {
  mockApiFetch.mockImplementation(async (path: string) => {
    if (path === "/api/eu") return { id: "1", nome, usuario: "joao", administrador };
    return { aberta: true, mesAlvo: "2026-10-01" };
  });
}

beforeEach(() => {
  mockApiFetch.mockReset();
  mockarApi();
});

function logar(papel: Papel = "publicador") {
  iniciarSessao({ token: "jwt", papel });
}

function renderizar(caminho = "/") {
  render(
    <MemoryRouter initialEntries={[caminho]}>
      <Layout>
        <Routes>
          <Route path="/" element={<p>Início</p>} />
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

describe("Layout — menu Olá do publicador", () => {
  it("mostra só o primeiro nome da conta (GET /api/eu)", async () => {
    logar();
    renderizar();

    const botao = await screen.findByRole("button", { name: /Olá, João/ });
    expect(botao).not.toHaveTextContent("Silva");
    expect(mockApiFetch).toHaveBeenCalledWith("/api/eu");
  });

  it("o menu tem Sair, que encerra a sessão e vai ao login", async () => {
    logar();
    const user = renderizar();

    const botao = await screen.findByRole("button", { name: /Olá, João/ });
    expect(botao).toHaveAttribute("aria-expanded", "false");
    await user.click(botao);
    expect(botao).toHaveAttribute("aria-expanded", "true");
    await user.click(screen.getByRole("button", { name: "Sair" }));

    expect(screen.getByText("Tela de login")).toBeInTheDocument();
    expect(obterSessao()).toBeNull();
  });

  it("não tem edição de nome", async () => {
    logar();
    const user = renderizar();

    await user.click(await screen.findByRole("button", { name: /Olá, João/ }));

    expect(screen.queryByRole("link", { name: /nome/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("Esc fecha o menu e devolve o foco", async () => {
    logar();
    const user = renderizar();
    const botao = await screen.findByRole("button", { name: /Olá, João/ });

    await user.click(botao);
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("button", { name: "Sair" })).not.toBeInTheDocument();
    expect(botao).toHaveFocus();
  });

  it("administrador vê o link Administração", async () => {
    mockarApi({ administrador: true });
    logar("administrador");
    const user = renderizar();

    await user.click(await screen.findByRole("link", { name: "Administração" }));

    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("publicador comum não vê o link Administração", async () => {
    logar();
    renderizar();

    await screen.findByRole("button", { name: /Olá, João/ });
    expect(screen.queryByRole("link", { name: "Administração" })).not.toBeInTheDocument();
  });

  it("sem login, não aparece (nem pergunta à API)", () => {
    renderizar("/login");

    expect(screen.queryByRole("button", { name: /Olá/ })).not.toBeInTheDocument();
    expect(mockApiFetch).not.toHaveBeenCalledWith("/api/eu");
  });

  it("o publicador não tem menu de navegação; o título leva à tela inicial", async () => {
    logar();
    const user = renderizar("/login");

    expect(screen.queryByRole("link", { name: "Início" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Escala TPL" }));
    expect(screen.getByText("Início")).toBeInTheDocument();
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

  it("administrador (que também é publicador) tem o link Meus pedidos", async () => {
    logar("administrador");
    const user = renderizar("/admin");

    await user.click(screen.getByRole("button", { name: "Menu" }));
    await user.click(screen.getByRole("link", { name: "Meus pedidos" }));

    expect(screen.getByText("Início")).toBeInTheDocument();
  });

  it("administrador de recuperação não tem Meus pedidos", async () => {
    logar("recuperacao");
    const user = renderizar("/admin");

    await user.click(screen.getByRole("button", { name: "Menu" }));

    expect(screen.queryByRole("link", { name: "Meus pedidos" })).not.toBeInTheDocument();
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
    logar("recuperacao");
    const user = renderizar("/admin");

    await user.click(screen.getByRole("button", { name: "Menu" }));
    await user.click(screen.getByRole("button", { name: "Sair" }));

    expect(screen.getByText("Tela de login")).toBeInTheDocument();
    expect(obterSessao()).toBeNull();
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
