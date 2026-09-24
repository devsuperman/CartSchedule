import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, ApiError } from "../../../api/client";
import { PUBLICADOR_NOME_STORAGE_KEY } from "../../../api/client";
import { SolicitacaoWizard, type Carrinho } from "./SolicitacaoWizard";

vi.mock("../../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../api/client")>()),
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

// Carrinho 01: 08–10 na Segunda e 10–12 na Terça. Carrinho 02: só 14–16 na Segunda.
// Carrinho 03: nenhum turno configurado (não deve aparecer para o publicador).
const CARRINHOS: Carrinho[] = [
  {
    id: 1,
    nome: "Carrinho 01",
    descricao: "Em frente à estação",
    disponibilidades: [
      { diaSemana: 1, turnoId: 2 },
      { diaSemana: 2, turnoId: 3 },
    ],
  },
  { id: 2, nome: "Carrinho 02", descricao: null, disponibilidades: [{ diaSemana: 1, turnoId: 4 }] },
  { id: 3, nome: "Carrinho 03", descricao: null, disponibilidades: [] },
];

function renderWizard() {
  render(
    <MemoryRouter>
      <SolicitacaoWizard mesAlvo="2026-10-01" />
    </MemoryRouter>,
  );
  return userEvent.setup();
}

async function continuar(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Continuar" }));
}

/** Espera a primeira etapa (carrinho) com os carrinhos carregados. */
async function irParaEtapaDoCarrinho() {
  await screen.findByText("Em qual carrinho?");
  // Espera os carrinhos chegarem.
  await screen.findByRole("radio", { name: /Carrinho 01/ });
}

/** Escolhe o carrinho e avança para a etapa do dia. */
async function escolherCarrinho(user: ReturnType<typeof userEvent.setup>, nome: RegExp) {
  await user.click(screen.getByRole("radio", { name: nome }));
  await continuar(user);
  await screen.findByText("Em qual dia da semana?");
}

function radiosVisiveis() {
  return screen.getAllByRole("radio").map((r) => r.textContent);
}

beforeEach(() => {
  localStorage.setItem(PUBLICADOR_NOME_STORAGE_KEY, "Bia");
  mockApiFetch.mockReset();
  mockApiFetch.mockImplementation(async (path) => {
    if (path === "/api/carrinhos") return CARRINHOS;
    if (path === "/api/solicitacoes") return { id: 10 };
    throw new Error(`chamada inesperada: ${path}`);
  });
});

describe("SolicitacaoWizard — carrinho antes do dia da semana", () => {
  it("mostra só os carrinhos com algum turno configurado", async () => {
    renderWizard();
    await irParaEtapaDoCarrinho();

    expect(radiosVisiveis()).toEqual([
      expect.stringContaining("Carrinho 01"),
      expect.stringContaining("Carrinho 02"),
    ]);
    expect(screen.queryByRole("radio", { name: /Carrinho 03/ })).not.toBeInTheDocument();
  });

  it("mostra só os dias em que o carrinho escolhido tem turno", async () => {
    const user = renderWizard();
    await irParaEtapaDoCarrinho();
    await escolherCarrinho(user, /Carrinho 02/);
    expect(radiosVisiveis()).toEqual(["Segunda-feira"]);

    await user.click(screen.getByRole("button", { name: "Voltar" }));
    await escolherCarrinho(user, /Carrinho 01/);
    expect(radiosVisiveis()).toEqual(["Segunda-feira", "Terça-feira"]);
    expect(screen.queryByText("Vale para todas as semanas do mês.")).not.toBeInTheDocument();
  });

  it("na terça o Carrinho 01 oferece só 10–12", async () => {
    const user = renderWizard();
    await irParaEtapaDoCarrinho();
    await escolherCarrinho(user, /Carrinho 01/);

    await user.click(screen.getByRole("radio", { name: /Terça-feira/ }));
    await continuar(user);
    expect(radiosVisiveis()).toEqual(["10:00–12:00"]);
  });

  it("na segunda o Carrinho 01 oferece só 08–10", async () => {
    const user = renderWizard();
    await irParaEtapaDoCarrinho();
    await escolherCarrinho(user, /Carrinho 01/);

    await user.click(screen.getByRole("radio", { name: /Segunda-feira/ }));
    await continuar(user);
    expect(radiosVisiveis()).toEqual(["08:00–10:00"]);
  });

  it("ao voltar e trocar para um carrinho que não funciona no dia escolhido, limpa dia e turno", async () => {
    const user = renderWizard();
    await irParaEtapaDoCarrinho();
    await escolherCarrinho(user, /Carrinho 01/);
    await user.click(screen.getByRole("radio", { name: /Terça-feira/ }));
    await continuar(user);
    await user.click(screen.getByRole("radio", { name: "10:00–12:00" }));

    await user.click(screen.getByRole("button", { name: "Voltar" }));
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    await escolherCarrinho(user, /Carrinho 02/);

    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).toHaveAttribute("aria-checked", "false");
    }
    expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled();
  });

  it("envia nome, carrinho, dia e turno escolhidos", async () => {
    const user = renderWizard();
    await irParaEtapaDoCarrinho();
    await escolherCarrinho(user, /Carrinho 01/);
    await user.click(screen.getByRole("radio", { name: /Terça-feira/ }));
    await continuar(user);
    await user.click(screen.getByRole("radio", { name: "10:00–12:00" }));
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith("/api/solicitacoes", expect.objectContaining({ method: "POST" })),
    );
    const [, opcoes] = mockApiFetch.mock.calls.find(([path]) => path === "/api/solicitacoes")!;
    expect(JSON.parse(opcoes!.body as string)).toEqual({ nome: "Bia", carrinhoId: 1, diaSemana: 2, turnoId: 3 });
  });

  it("quando o servidor limita o envio (429), mostra o aviso para aguardar", async () => {
    mockApiFetch.mockImplementation(async (path) => {
      if (path === "/api/carrinhos") return CARRINHOS;
      throw new ApiError(429, "Muitas tentativas. Aguarde um pouco e tente novamente.", {
        codigo: "MUITAS_REQUISICOES",
      });
    });
    const user = renderWizard();
    await irParaEtapaDoCarrinho();
    await escolherCarrinho(user, /Carrinho 01/);
    await user.click(screen.getByRole("radio", { name: /Terça-feira/ }));
    await continuar(user);
    await user.click(screen.getByRole("radio", { name: "10:00–12:00" }));
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Muitas tentativas. Aguarde um pouco e tente novamente.")).toBeInTheDocument();
  });
});

describe("SolicitacaoWizard — mês-alvo", () => {
  it("mostra o mês-alvo no topo em todas as etapas", async () => {
    const user = renderWizard();
    expect(screen.getByText("outubro de 2026")).toBeInTheDocument();

    await irParaEtapaDoCarrinho();
    expect(screen.getByText("outubro de 2026")).toBeInTheDocument();

    await escolherCarrinho(user, /Carrinho 01/);
    expect(screen.getByText("outubro de 2026")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /Terça-feira/ }));
    await continuar(user);
    await screen.findByText("Em qual turno?");
    expect(screen.getByText("outubro de 2026")).toBeInTheDocument();
  });
});

describe("SolicitacaoWizard — 3 etapas, sem o nome", () => {
  it("abre no carrinho, em 3 passos, sem pedir o nome", async () => {
    renderWizard();
    await irParaEtapaDoCarrinho();

    expect(screen.getByText("Passo 1 de 3")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Seu nome" })).not.toBeInTheDocument();
  });

  it("Voltar na primeira etapa sai para a tela inicial", async () => {
    render(
      <MemoryRouter initialEntries={["/solicitar"]}>
        <Routes>
          <Route path="/" element={<p>Tela inicial</p>} />
          <Route path="/solicitar" element={<SolicitacaoWizard mesAlvo="2026-10-01" />} />
        </Routes>
      </MemoryRouter>,
    );
    const user = userEvent.setup();
    await irParaEtapaDoCarrinho();

    await user.click(screen.getByRole("button", { name: "Voltar" }));

    expect(screen.getByText("Tela inicial")).toBeInTheDocument();
  });
});
