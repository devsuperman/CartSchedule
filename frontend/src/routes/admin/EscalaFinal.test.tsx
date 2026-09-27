import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, ApiError } from "../../api/client";
import EscalaFinal from "./EscalaFinal";
import RedirecionaParaEscala from "./RedirecionaParaEscala";

vi.mock("../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/client")>()),
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

function pedido(solicitacaoId: number, publicadorId: string, publicadorNome: string, totalNaEscala: number) {
  return { solicitacaoId, publicadorId, publicadorNome, origem: 1, totalNaEscala };
}

function celula(carrinhoId: number, diaSemana: number, turnoId: number, publicadores: unknown[], disponivel = true) {
  return {
    carrinhoId,
    carrinhoNome: `Carrinho 0${carrinhoId}`,
    diaSemana,
    turnoId,
    disponivel,
    publicadores,
  };
}

// Turnos: 1 = 06–08, 2 = 08–10, 3 = 10–12. Ana tem 2 pedidos na escala.
const GRADE = {
  mes: "2026-10",
  celulas: [
    celula(1, 1, 2, [pedido(1, "ana", "Ana", 2), pedido(2, "bia", "Bia", 1), pedido(3, "caio", "Caio", 1)]),
    celula(1, 1, 3, []),
    celula(1, 2, 2, [pedido(4, "ana", "Ana", 2), pedido(5, "fabi", "Fabi", 1)]),
    celula(2, 1, 1, [pedido(6, "dani", "Dani", 1)]),
    celula(2, 1, 2, [pedido(7, "edu", "Edu", 1)], false),
  ],
};

beforeEach(() => {
  mockApiFetch.mockReset();
  mockApiFetch.mockImplementation(async (path, init) => {
    if (path === "/api/admin/escalas/2026-10/grade") return structuredClone(GRADE);
    if (init?.method === "PATCH" || init?.method === "DELETE" || init?.method === "PUT") return undefined;
    if (init?.method === "POST") {
      return { id: 99, publicadorId: "gil", publicadorNome: "Gil", carrinhoId: 1, diaSemana: 1, turnoId: 3, origem: 2 };
    }
    throw new Error(`chamada inesperada: ${path}`);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function renderTela() {
  render(
    <MemoryRouter initialEntries={["/admin/escalas/2026-10"]}>
      <Routes>
        <Route path="/admin/escalas/:mes" element={<EscalaFinal />} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByRole("heading", { name: "Escala" });
  return userEvent.setup();
}

function carrinho(nome: string) {
  return screen.getByRole("heading", { name: nome }).closest("section") as HTMLElement;
}

/** Linha de um turno no layout de celular (lista do dia escolhido). */
function linhaTurno(nomeCarrinho: string, turno: string) {
  return within(carrinho(nomeCarrinho)).getByText(turno).closest("li") as HTMLElement;
}

function barraDeAcoes() {
  return screen.getByRole("region", { name: "Ações do pedido selecionado" });
}

function chamadas(metodo: string) {
  return mockApiFetch.mock.calls.filter(([, init]) => init?.method === metodo);
}

describe("EscalaFinal (gestão da escala)", () => {
  it("mostra todas as vagas, inclusive as vazias, com o resumo de ocupação", async () => {
    await renderTela();

    expect(screen.getByText("Pedidos").nextSibling).toHaveTextContent("7");
    expect(screen.getByText("Vagas com espaço").nextSibling).toHaveTextContent("2");
    expect(screen.getByText("Vagas com excesso").nextSibling).toHaveTextContent("1");

    expect(within(linhaTurno("Carrinho 01", "10:00–12:00")).getByText("livre")).toBeInTheDocument();
    expect(within(linhaTurno("Carrinho 01", "08:00–10:00")).getByText("3 pessoas")).toBeInTheDocument();
    // Quinta não tem vaga no Carrinho 01.
    expect(within(carrinho("Carrinho 01")).getByRole("button", { name: "Quinta-feira" })).toBeDisabled();
  });

  it("tocar num nome abre a barra com Mover em destaque, sem Cancelar; Fechar só tira a seleção", async () => {
    const user = await renderTela();

    await user.click(within(linhaTurno("Carrinho 01", "08:00–10:00")).getByRole("button", { name: "Ana" }));

    const barra = barraDeAcoes();
    expect(within(barra).getByText("Carrinho 01, Segunda-feira, 08:00–10:00 · 2 pedidos nesta escala")).toBeInTheDocument();
    expect(within(barra).getByRole("button", { name: "Mover" })).toBeInTheDocument();
    expect(within(barra).getByRole("button", { name: "Editar nome" })).toBeInTheDocument();
    expect(within(barra).getByRole("button", { name: "Excluir pedido" })).toBeInTheDocument();
    expect(within(barra).queryByRole("button", { name: /cancelar/i })).not.toBeInTheDocument();

    await user.click(within(barra).getByRole("button", { name: "Fechar" }));
    expect(screen.queryByRole("region", { name: "Ações do pedido selecionado" })).not.toBeInTheDocument();

    // Tocar de novo no mesmo nome também tira a seleção.
    const ana = within(linhaTurno("Carrinho 01", "08:00–10:00")).getByRole("button", { name: "Ana" });
    await user.click(ana);
    await user.click(ana);
    expect(screen.queryByRole("region", { name: "Ações do pedido selecionado" })).not.toBeInTheDocument();
    expect(chamadas("PATCH")).toHaveLength(0);
    expect(chamadas("DELETE")).toHaveLength(0);
  });

  it("move para uma vaga livre: toca em Mover, na vaga e confirma", async () => {
    const user = await renderTela();

    await user.click(within(linhaTurno("Carrinho 01", "08:00–10:00")).getByRole("button", { name: "Caio" }));
    await user.click(within(barraDeAcoes()).getByRole("button", { name: "Mover" }));
    expect(within(barraDeAcoes()).getByText("Toque na vaga para onde Caio vai.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Mover para Carrinho 01, Segunda-feira, 10:00–12:00 (livre)" }));
    const modal = screen.getByRole("dialog", { name: "Mover Caio?" });
    expect(modal).toHaveTextContent(
      "De Carrinho 01, Segunda-feira, 08:00–10:00 para Carrinho 01, Segunda-feira, 10:00–12:00.",
    );
    await user.click(within(modal).getByRole("button", { name: "Mover" }));

    expect(mockApiFetch).toHaveBeenCalledWith("/api/admin/solicitacoes/3", {
      method: "PATCH",
      body: JSON.stringify({ carrinhoId: 1, diaSemana: 1, turnoId: 3 }),
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(within(linhaTurno("Carrinho 01", "10:00–12:00")).getByRole("button", { name: "Caio" })).toBeInTheDocument();
    expect(within(linhaTurno("Carrinho 01", "08:00–10:00")).queryByRole("button", { name: "Caio" })).not.toBeInTheDocument();
    expect(within(linhaTurno("Carrinho 01", "08:00–10:00")).getByText("cheia")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Caio agora está em Carrinho 01, Segunda-feira, 10:00–12:00.");
    expect(screen.queryByRole("region", { name: "Ações do pedido selecionado" })).not.toBeInTheDocument();
  });

  it("move para outro dia com a vaga cheia: avisa, mas deixa mover", async () => {
    const user = await renderTela();

    await user.click(within(linhaTurno("Carrinho 01", "08:00–10:00")).getByRole("button", { name: "Bia" }));
    await user.click(within(barraDeAcoes()).getByRole("button", { name: "Mover" }));
    // A seleção continua ao trocar de dia.
    await user.click(within(carrinho("Carrinho 01")).getByRole("button", { name: "Terça-feira" }));
    await user.click(screen.getByRole("button", { name: "Mover para Carrinho 01, Terça-feira, 08:00–10:00 (cheia)" }));

    const modal = screen.getByRole("dialog", { name: "Mover Bia?" });
    expect(modal).toHaveTextContent("Essa vaga já tem 2 pessoas. Com Bia, ficará com 3.");
    await user.click(within(modal).getByRole("button", { name: "Mover" }));

    expect(chamadas("PATCH")).toHaveLength(1);
    expect(within(linhaTurno("Carrinho 01", "08:00–10:00")).getByText("3 pessoas")).toBeInTheDocument();
  });

  it("vaga não configurada não vira destino e a de origem fica marcada", async () => {
    const user = await renderTela();

    await user.click(within(linhaTurno("Carrinho 02", "06:00–08:00")).getByRole("button", { name: "Dani" }));
    await user.click(within(barraDeAcoes()).getByRole("button", { name: "Mover" }));

    expect(screen.queryByRole("button", { name: /^Mover para Carrinho 02, Segunda-feira, 08:00–10:00/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Mover para Carrinho 02, Segunda-feira, 06:00–08:00/ })).not.toBeInTheDocument();
    expect(within(linhaTurno("Carrinho 02", "06:00–08:00")).getByText("sai daqui")).toBeInTheDocument();
  });

  it("duplicidade (409) aparece no modal e nada muda", async () => {
    mockApiFetch.mockImplementation(async (path, init) => {
      if (path === "/api/admin/escalas/2026-10/grade") return structuredClone(GRADE);
      if (init?.method === "PATCH") throw new ApiError(409, "Solicitação duplicada.");
      throw new Error(`chamada inesperada: ${path}`);
    });
    const user = await renderTela();

    await user.click(within(linhaTurno("Carrinho 01", "08:00–10:00")).getByRole("button", { name: "Ana" }));
    await user.click(within(barraDeAcoes()).getByRole("button", { name: "Mover" }));
    await user.click(screen.getByRole("button", { name: "Mover para Carrinho 01, Segunda-feira, 10:00–12:00 (livre)" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Mover" }));

    expect(within(screen.getByRole("dialog")).getByText("Ana já tem um pedido nessa vaga.")).toBeInTheDocument();
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Voltar" }));
    // Continua escolhendo o destino, com a Ana ainda na vaga de origem.
    const origem = linhaTurno("Carrinho 01", "08:00–10:00");
    expect(within(origem).getByText("Ana")).toBeInTheDocument();
    expect(within(origem).getByText("sai daqui")).toBeInTheDocument();
  });

  it("Excluir pede confirmação, apaga e atualiza a contagem de apoio da pessoa", async () => {
    const user = await renderTela();

    await user.click(within(linhaTurno("Carrinho 01", "08:00–10:00")).getByRole("button", { name: "Ana" }));
    await user.click(within(barraDeAcoes()).getByRole("button", { name: "Excluir pedido" }));
    const modal = screen.getByRole("dialog", { name: "Excluir pedido?" });
    expect(modal).toHaveTextContent("Ana — Carrinho 01, Segunda-feira, 08:00–10:00. Isso não pode ser desfeito.");
    await user.click(within(modal).getByRole("button", { name: "Excluir" }));

    expect(mockApiFetch).toHaveBeenCalledWith("/api/admin/solicitacoes/1", { method: "DELETE" });
    expect(within(linhaTurno("Carrinho 01", "08:00–10:00")).queryByRole("button", { name: "Ana" })).not.toBeInTheDocument();

    await user.click(within(carrinho("Carrinho 01")).getByRole("button", { name: "Terça-feira" }));
    await user.click(within(linhaTurno("Carrinho 01", "08:00–10:00")).getByRole("button", { name: "Ana" }));
    expect(within(barraDeAcoes()).getByText(/· 1 pedido nesta escala$/)).toBeInTheDocument();
  });

  it("Voltar no modal de exclusão não apaga nada", async () => {
    const user = await renderTela();

    await user.click(within(linhaTurno("Carrinho 01", "08:00–10:00")).getByRole("button", { name: "Bia" }));
    await user.click(within(barraDeAcoes()).getByRole("button", { name: "Excluir pedido" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Voltar" }));

    expect(chamadas("DELETE")).toHaveLength(0);
    expect(within(linhaTurno("Carrinho 01", "08:00–10:00")).getByRole("button", { name: "Bia" })).toBeInTheDocument();
  });

  it("adiciona alguém tocando no + de uma vaga", async () => {
    const user = await renderTela();

    await user.click(screen.getByRole("button", { name: "Adicionar pessoa em Carrinho 01, Segunda-feira, 10:00–12:00" }));
    const modal = screen.getByRole("dialog", { name: "Adicionar pessoa" });
    await user.type(within(modal).getByRole("combobox", { name: "Nome do publicador" }), "  Gil ");
    await user.click(within(modal).getByRole("button", { name: "Adicionar" }));

    expect(mockApiFetch).toHaveBeenCalledWith("/api/admin/escalas/2026-10/solicitacoes", {
      method: "POST",
      body: JSON.stringify({ nome: "Gil", carrinhoId: 1, diaSemana: 1, turnoId: 3 }),
    });
    expect(within(linhaTurno("Carrinho 01", "10:00–12:00")).getByRole("button", { name: "Gil" })).toBeInTheDocument();
    expect(screen.getByText("Pedidos").nextSibling).toHaveTextContent("8");
  });

  it("vaga não configurada não tem o + de adicionar", async () => {
    await renderTela();

    expect(
      screen.queryByRole("button", { name: "Adicionar pessoa em Carrinho 02, Segunda-feira, 08:00–10:00" }),
    ).not.toBeInTheDocument();
  });

  it("Editar nome renomeia todos os pedidos da pessoa", async () => {
    const user = await renderTela();

    await user.click(within(linhaTurno("Carrinho 01", "08:00–10:00")).getByRole("button", { name: "Ana" }));
    await user.click(within(barraDeAcoes()).getByRole("button", { name: "Editar nome" }));
    const campo = screen.getByRole("textbox", { name: "Nome do publicador" });
    await user.clear(campo);
    await user.type(campo, "Ana Paula");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(within(linhaTurno("Carrinho 01", "08:00–10:00")).getByRole("button", { name: "Ana Paula" })).toBeInTheDocument();
    await user.click(within(carrinho("Carrinho 01")).getByRole("button", { name: "Terça-feira" }));
    expect(within(linhaTurno("Carrinho 01", "08:00–10:00")).getByRole("button", { name: "Ana Paula" })).toBeInTheDocument();
  });

  it("no tablet mostra a grade Turno × Dia", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: true,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    await renderTela();

    const tabela = within(carrinho("Carrinho 01")).getByRole("table");
    expect(within(tabela).getByRole("columnheader", { name: "Sexta-feira" })).toBeInTheDocument();
    expect(within(tabela).getAllByRole("button", { name: "Ana" })).toHaveLength(2);
  });
});

describe("RedirecionaParaEscala", () => {
  it("leva os links antigos de Revisão e Adicionar para a Escala", async () => {
    render(
      <MemoryRouter initialEntries={["/admin/revisao/2026-10"]}>
        <Routes>
          <Route path="/admin/revisao/:mes" element={<RedirecionaParaEscala />} />
          <Route path="/admin/escalas/:mes" element={<EscalaFinal />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Escala" })).toBeInTheDocument();
  });
});
