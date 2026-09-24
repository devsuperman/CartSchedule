import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../../../api/client";
import { PUBLICADOR_NOME_STORAGE_KEY } from "../../../api/client";
import { SolicitacaoWizard, type Carrinho } from "./SolicitacaoWizard";

vi.mock("../../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../api/client")>()),
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

// Carrinho 01: 08–10 na Segunda e 10–12 na Terça. Carrinho 02: só 14–16 na Segunda.
// Nenhum carrinho funciona de Quarta a Sexta.
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

/** Passa da etapa do nome (já preenchido via localStorage) para a do dia. */
async function irParaEtapaDoDia(user: ReturnType<typeof userEvent.setup>) {
  await continuar(user);
  await screen.findByText("Em qual dia da semana?");
  // Espera os carrinhos chegarem para os dias sem turno já estarem desabilitados.
  await waitFor(() => expect(screen.getByRole("radio", { name: /Quarta-feira/ })).toBeDisabled());
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

describe("SolicitacaoWizard — turnos por dia da semana", () => {
  it("desabilita os dias em que nenhum carrinho tem turno", async () => {
    const user = renderWizard();
    await irParaEtapaDoDia(user);

    expect(screen.getByRole("radio", { name: /Segunda-feira/ })).toBeEnabled();
    expect(screen.getByRole("radio", { name: /Terça-feira/ })).toBeEnabled();
    for (const dia of [/Quarta-feira/, /Quinta-feira/, /Sexta-feira/]) {
      const botao = screen.getByRole("radio", { name: dia });
      expect(botao).toBeDisabled();
      expect(botao).toHaveTextContent("sem turnos");
    }
  });

  it("mostra só os carrinhos com turno no dia e só os turnos daquele carrinho naquele dia", async () => {
    const user = renderWizard();
    await irParaEtapaDoDia(user);

    await user.click(screen.getByRole("radio", { name: /Terça-feira/ }));
    await continuar(user);
    expect(radiosVisiveis()).toEqual([expect.stringContaining("Carrinho 01")]);

    await user.click(screen.getByRole("radio", { name: /Carrinho 01/ }));
    await continuar(user);
    expect(radiosVisiveis()).toEqual(["10:00–12:00"]);
  });

  it("na segunda o Carrinho 02 oferece só 14–16", async () => {
    const user = renderWizard();
    await irParaEtapaDoDia(user);

    await user.click(screen.getByRole("radio", { name: /Segunda-feira/ }));
    await continuar(user);
    expect(radiosVisiveis()).toHaveLength(2);

    await user.click(screen.getByRole("radio", { name: /Carrinho 02/ }));
    await continuar(user);
    expect(radiosVisiveis()).toEqual(["14:00–16:00"]);
  });

  it("ao voltar e trocar para um dia em que o carrinho escolhido não funciona, limpa carrinho e turno", async () => {
    const user = renderWizard();
    await irParaEtapaDoDia(user);
    await user.click(screen.getByRole("radio", { name: /Segunda-feira/ }));
    await continuar(user);
    await user.click(screen.getByRole("radio", { name: /Carrinho 02/ }));
    await continuar(user);
    await user.click(screen.getByRole("radio", { name: "14:00–16:00" }));

    await user.click(screen.getByRole("button", { name: "Voltar" }));
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    await user.click(screen.getByRole("radio", { name: /Terça-feira/ }));
    await continuar(user);

    expect(radiosVisiveis()).toEqual([expect.stringContaining("Carrinho 01")]);
    expect(screen.getByRole("radio", { name: /Carrinho 01/ })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled();
  });

  it("envia nome, carrinho, dia e turno escolhidos", async () => {
    const user = renderWizard();
    await irParaEtapaDoDia(user);
    await user.click(screen.getByRole("radio", { name: /Terça-feira/ }));
    await continuar(user);
    await user.click(screen.getByRole("radio", { name: /Carrinho 01/ }));
    await continuar(user);
    await user.click(screen.getByRole("radio", { name: "10:00–12:00" }));
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith("/api/solicitacoes", expect.objectContaining({ method: "POST" })),
    );
    const [, opcoes] = mockApiFetch.mock.calls.find(([path]) => path === "/api/solicitacoes")!;
    expect(JSON.parse(opcoes!.body as string)).toEqual({ nome: "Bia", carrinhoId: 1, diaSemana: 2, turnoId: 3 });
  });
});

describe("SolicitacaoWizard — mês-alvo", () => {
  it("mostra o mês-alvo no topo em todas as etapas", async () => {
    const user = renderWizard();
    expect(screen.getByText("outubro de 2026")).toBeInTheDocument();

    await irParaEtapaDoDia(user);
    expect(screen.getByText("outubro de 2026")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /Terça-feira/ }));
    await continuar(user);
    expect(screen.getByText("outubro de 2026")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /Carrinho 01/ }));
    await continuar(user);
    await screen.findByText("Em qual turno?");
    expect(screen.getByText("outubro de 2026")).toBeInTheDocument();
  });
});
