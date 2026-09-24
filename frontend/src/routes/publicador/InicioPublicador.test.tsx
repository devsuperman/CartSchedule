import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../../api/client";
import InicioPublicador from "./InicioPublicador";
import type { Solicitacao } from "./components/SolicitacaoCard";

vi.mock("../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/client")>()),
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

// Mês-alvo vem da janela, então é sempre um mês "relevante" independente da data real.
const MES_ALVO = "2030-10-01";

function pedido(id: number, diaSemana: number, turnoId: number, carrinhoNome: string): Solicitacao {
  return {
    id,
    escalaMesReferencia: MES_ALVO,
    carrinhoId: id,
    carrinhoNome,
    diaSemana,
    turnoId,
    status: 1,
    origem: 1,
  };
}

// Fora de ordem de propósito (o backend devolve por data de criação).
const SOLICITACOES: Solicitacao[] = [
  pedido(1, 3, 2, "Carrinho 01"),
  pedido(2, 1, 4, "Carrinho 01"),
  pedido(3, 1, 2, "Carrinho 10"),
  pedido(4, 1, 2, "Carrinho 2"),
  pedido(5, 1, 1, "Carrinho 03"),
];

beforeEach(() => {
  mockApiFetch.mockReset();
  mockApiFetch.mockImplementation(async (path) => {
    if (path === "/api/janela") return { aberta: false, mesAlvo: MES_ALVO };
    if (path === "/api/solicitacoes") return SOLICITACOES;
    throw new Error(`chamada inesperada: ${path}`);
  });
});

describe("InicioPublicador — ordem do histórico", () => {
  it("agrupa por dia da semana e ordena por turno e depois por carrinho", async () => {
    render(
      <MemoryRouter>
        <InicioPublicador />
      </MemoryRouter>,
    );

    const dias = await screen.findAllByRole("heading", { level: 3 });
    expect(dias.map((h) => h.textContent)).toEqual(["Segunda-feira", "Quarta-feira"]);

    const segunda = dias[0].parentElement!;
    expect(within(segunda).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      expect.stringMatching(/^Carrinho 03.*06:00–08:00/),
      expect.stringMatching(/^Carrinho 2.*08:00–10:00/),
      expect.stringMatching(/^Carrinho 10.*08:00–10:00/),
      expect.stringMatching(/^Carrinho 01.*14:00–16:00/),
    ]);

    const quarta = dias[1].parentElement!;
    expect(within(quarta).getAllByRole("listitem")).toHaveLength(1);
  });
});
