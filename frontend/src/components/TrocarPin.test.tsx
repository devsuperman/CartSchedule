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
  await user.click(screen.getByRole("button", { name: "Trocar senha" }));
  return user;
}

async function preencher(user: ReturnType<typeof userEvent.setup>, atual: string, novo: string, confirmacao = novo) {
  await user.type(screen.getByLabelText("Senha atual"), atual);
  await user.type(screen.getByLabelText("Nova senha"), novo);
  await user.type(screen.getByLabelText("Confirme a nova senha"), confirmacao);
  await user.click(screen.getByRole("button", { name: "Trocar senha" }));
}

function chamadasDaTroca() {
  return mockApiFetch.mock.calls.filter(([path]) => path === "/api/eu/pin");
}

function erroDaApi(status: number, mensagem: string, codigo: string) {
  return async () => {
    throw new ApiError(status, mensagem, { codigo });
  };
}

describe("Trocar senha (menu Olá)", () => {
  it("o menu abre o diálogo com senha atual, nova senha e confirmação", async () => {
    await abrirDialogo();

    expect(screen.getByRole("dialog", { name: "Trocar senha" })).toBeInTheDocument();
    for (const rotulo of ["Senha atual", "Nova senha", "Confirme a nova senha"]) {
      expect(screen.getByLabelText(rotulo)).toHaveAttribute("inputmode", "numeric");
    }
  });

  it("troca a senha, guarda o token novo e avisa que os outros aparelhos saíram", async () => {
    const user = await abrirDialogo();

    await preencher(user, "1357", "2580");

    expect(mockApiFetch).toHaveBeenCalledWith("/api/eu/pin", {
      method: "PUT",
      body: JSON.stringify({ pinAtual: "1357", pinNovo: "2580" }),
    });
    expect(await screen.findByRole("dialog", { name: "Senha trocada" })).toBeInTheDocument();
    expect(await screen.findByText(/outros aparelhos foram desconectados/)).toBeInTheDocument();
    expect(obterSessao()).toEqual({ token: "token-novo", papel: "publicador" });

    await user.click(screen.getByRole("button", { name: "Entendi" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("confirmação diferente não chama a API", async () => {
    const user = await abrirDialogo();

    await preencher(user, "1357", "2580", "2581");

    expect(screen.getByRole("alert")).toHaveTextContent("A confirmação não é igual à nova senha.");
    expect(chamadasDaTroca()).toHaveLength(0);
  });

  it("nova senha sem 4 dígitos não chama a API", async () => {
    const user = await abrirDialogo();

    await preencher(user, "1357", "258");

    expect(screen.getByRole("alert")).toHaveTextContent("A nova senha precisa ter exatamente 4 dígitos.");
    expect(chamadasDaTroca()).toHaveLength(0);
  });

  it("senha atual errada mostra o erro e mantém a sessão", async () => {
    mockarApi(erroDaApi(400, "A senha atual não confere.", "PIN_ATUAL_INVALIDO"));
    const user = await abrirDialogo();

    await preencher(user, "9999", "2580");

    expect(await screen.findByRole("alert")).toHaveTextContent("A senha atual não confere.");
    expect(obterSessao()?.token).toBe("token-antigo");
    expect(screen.getByRole("dialog", { name: "Trocar senha" })).toBeInTheDocument();
  });

  it("senha fraca pede outra", async () => {
    mockarApi(erroDaApi(400, "Essa senha é fácil de adivinhar.", "PIN_FRACO"));
    const user = await abrirDialogo();

    await preencher(user, "1357", "1234");

    expect(await screen.findByRole("alert")).toHaveTextContent("fácil de adivinhar");
  });

  it("muitas tentativas mostra a mensagem do servidor", async () => {
    mockarApi(erroDaApi(429, "Muitas tentativas. Aguarde um pouco.", "MUITAS_REQUISICOES"));
    const user = await abrirDialogo();

    await preencher(user, "1357", "2580");

    expect(await screen.findByRole("alert")).toHaveTextContent("Muitas tentativas. Aguarde um pouco.");
  });

  it("outro erro mostra uma mensagem genérica", async () => {
    mockarApi(erroDaApi(500, "Internal Server Error", "OUTRO"));
    const user = await abrirDialogo();

    await preencher(user, "1357", "2580");

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível trocar a senha. Tente de novo.");
  });

  it("Cancelar fecha sem trocar", async () => {
    const user = await abrirDialogo();

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(chamadasDaTroca()).toHaveLength(0);
  });
});
