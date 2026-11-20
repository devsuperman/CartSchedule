import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, ApiError } from "../api/client";
import { iniciarSessao, obterSessao } from "../api/sessao";
import { Layout } from "./Layout";

vi.mock("../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/client")>()),
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

function mockarApi(trocar: () => Promise<unknown>) {
  mockApiFetch.mockImplementation(async (path: string) => {
    if (path === "/api/eu") return { id: "1", nome: "Maria Souza", usuario: "maria", administrador: false };
    if (path === "/api/eu/pin") return trocar();
    throw new Error(`rota inesperada: ${path}`);
  });
}

beforeEach(() => {
  mockApiFetch.mockReset();
  mockarApi(async () => ({ token: "token-novo", papel: "publicador" }));
  iniciarSessao({ token: "token-antigo", papel: "publicador" });
});

async function abrirDialogo() {
  render(
    <MemoryRouter>
      <Layout>
        <p>Início</p>
      </Layout>
    </MemoryRouter>,
  );
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: /Olá, Maria/ }));
  await user.click(screen.getByRole("button", { name: "Trocar PIN" }));
  return user;
}

async function preencher(user: ReturnType<typeof userEvent.setup>, atual: string, novo: string, confirmacao = novo) {
  await user.type(screen.getByLabelText("PIN atual"), atual);
  await user.type(screen.getByLabelText("PIN novo"), novo);
  await user.type(screen.getByLabelText("Confirme o PIN novo"), confirmacao);
  await user.click(screen.getByRole("button", { name: "Trocar PIN" }));
}

function chamadasDaTroca() {
  return mockApiFetch.mock.calls.filter(([path]) => path === "/api/eu/pin");
}

function erroDaApi(codigo: string) {
  return async () => {
    throw new ApiError(400, "Erro do servidor", { codigo });
  };
}

describe("Trocar PIN (menu Olá)", () => {
  it("o menu abre o diálogo com PIN atual, PIN novo e confirmação", async () => {
    await abrirDialogo();

    expect(screen.getByRole("dialog", { name: "Trocar PIN" })).toBeInTheDocument();
    for (const rotulo of ["PIN atual", "PIN novo", "Confirme o PIN novo"]) {
      expect(screen.getByLabelText(rotulo)).toHaveAttribute("inputmode", "numeric");
    }
  });

  it("troca o PIN, guarda o token novo e avisa que os outros aparelhos saíram", async () => {
    const user = await abrirDialogo();

    await preencher(user, "1357", "2580");

    expect(mockApiFetch).toHaveBeenCalledWith("/api/eu/pin", {
      method: "PUT",
      body: JSON.stringify({ pinAtual: "1357", pinNovo: "2580" }),
    });
    expect(await screen.findByText(/outros aparelhos foram desconectados/)).toBeInTheDocument();
    expect(obterSessao()).toEqual({ token: "token-novo", papel: "publicador" });

    await user.click(screen.getByRole("button", { name: "Entendi" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("confirmação diferente não chama a API", async () => {
    const user = await abrirDialogo();

    await preencher(user, "1357", "2580", "2581");

    expect(screen.getByRole("alert")).toHaveTextContent("A confirmação não é igual ao PIN novo.");
    expect(chamadasDaTroca()).toHaveLength(0);
  });

  it("PIN novo sem 4 dígitos não chama a API", async () => {
    const user = await abrirDialogo();

    await preencher(user, "1357", "258");

    expect(screen.getByRole("alert")).toHaveTextContent("exatamente 4 dígitos");
    expect(chamadasDaTroca()).toHaveLength(0);
  });

  it("PIN atual errado mostra o erro e mantém a sessão", async () => {
    mockarApi(erroDaApi("PIN_ATUAL_INVALIDO"));
    const user = await abrirDialogo();

    await preencher(user, "9999", "2580");

    expect(await screen.findByRole("alert")).toHaveTextContent("O PIN atual não confere.");
    expect(obterSessao()?.token).toBe("token-antigo");
    expect(screen.getByRole("dialog", { name: "Trocar PIN" })).toBeInTheDocument();
  });

  it("PIN fraco pede outro", async () => {
    mockarApi(erroDaApi("PIN_FRACO"));
    const user = await abrirDialogo();

    await preencher(user, "1357", "1234");

    expect(await screen.findByRole("alert")).toHaveTextContent("fácil de adivinhar");
  });

  it("Cancelar fecha sem trocar", async () => {
    const user = await abrirDialogo();

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(chamadasDaTroca()).toHaveLength(0);
  });
});
