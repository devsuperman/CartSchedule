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

function pedido(
  id: number,
  diaSemana: number,
  turnoId: number,
  carrinhoNome: string,
  carrinhoDescricao: string | null = null,
  status = 1,
): Solicitacao {
  return {
    id,
    escalaMesReferencia: MES_ALVO,
    carrinhoId: id,
    carrinhoNome,
    carrinhoDescricao,
    diaSemana,
    turnoId,
    status,
    origem: 1,
  };
}

// Fora de ordem de propósito (o backend devolve por data de criação).
const SOLICITACOES: Solicitacao[] = [
  pedido(1, 3, 2, "Carrinho 01", "Praça central"),
  pedido(2, 1, 4, "Carrinho 01", "Praça central"),
  pedido(3, 1, 2, "Carrinho 10", "   "),
  pedido(4, 1, 2, "Carrinho 2", "Em frente à estação"),
  pedido(5, 1, 1, "Carrinho 03"),
  pedido(6, 2, 1, "Carrinho 04", null, 3), // Rejeitada: não aparece
];

beforeEach(() => {
  mockApiFetch.mockReset();
  mockApiFetch.mockImplementation(async (path) => {
    if (path === "/api/janela") return { aberta: false, mesAlvo: MES_ALVO };
    if (path === "/api/solicitacoes") return SOLICITACOES;
    throw new Error(`chamada inesperada: ${path}`);
  });
});

function renderizar() {
  render(
    <MemoryRouter>
      <InicioPublicador />
    </MemoryRouter>,
  );
}

describe("InicioPublicador — histórico", () => {
  it("lista os pedidos numa única lista ordenada por dia, turno e carrinho, sem títulos por dia", async () => {
    renderizar();

    const lista = await screen.findByRole("list");
    expect(screen.queryByRole("heading", { level: 3 })).not.toBeInTheDocument();
    expect(within(lista).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      expect.stringMatching(/^Segunda-feira.*06:00–08:00.*Carrinho 03/),
      expect.stringMatching(/^Segunda-feira.*08:00–10:00.*Carrinho 2/),
      expect.stringMatching(/^Segunda-feira.*08:00–10:00.*Carrinho 10/),
      expect.stringMatching(/^Segunda-feira.*14:00–16:00.*Carrinho 01/),
      expect.stringMatching(/^Quarta-feira.*08:00–10:00.*Carrinho 01/),
    ]);
  });

  it("mostra no card o dia, o turno, o carrinho e a descrição (só quando há descrição)", async () => {
    renderizar();

    const itens = within(await screen.findByRole("list")).getAllByRole("listitem");

    const comDescricao = within(itens[1]);
    expect(comDescricao.getByText("Segunda-feira")).toBeInTheDocument();
    expect(comDescricao.getByText("08:00–10:00")).toBeInTheDocument();
    expect(comDescricao.getByText("Carrinho 2")).toBeInTheDocument();
    expect(comDescricao.getByText("Em frente à estação")).toBeInTheDocument();

    // Descrição nula ou só com espaços: nada além de dia, turno e carrinho (sem status).
    expect(itens[0].textContent).toBe("Segunda-feira06:00–08:00Carrinho 03");
    expect(itens[2].textContent).toBe("Segunda-feira08:00–10:00Carrinho 10");
  });

  it("mostra só o mês no título da lista, sem cabeçalho da tela nem status", async () => {
    renderizar();

    expect(
      await screen.findByRole("heading", { name: "Minhas solicitações para outubro" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Minhas escalas")).not.toBeInTheDocument();
    expect(screen.queryByText(/Pedidos deste mês/)).not.toBeInTheDocument();
    expect(screen.queryByText("Pendente")).not.toBeInTheDocument();
  });

  it("esconde as solicitações rejeitadas", async () => {
    renderizar();

    await screen.findByRole("list");
    expect(screen.queryByText("Carrinho 04")).not.toBeInTheDocument();
    expect(screen.queryByText("Terça-feira")).not.toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
  });
});
