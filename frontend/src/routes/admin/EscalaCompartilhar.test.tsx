import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../../api/client";
import { compartilharImagem } from "../../utils/imagemEscala";
import EscalaCompartilhar from "./EscalaCompartilhar";
import { escalaParaCompartilhar } from "./components/escalaParaCompartilhar";

vi.mock("../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/client")>()),
  apiFetch: vi.fn(),
}));
vi.mock("../../utils/imagemEscala", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../utils/imagemEscala")>()),
  compartilharImagem: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);
const mockCompartilhar = vi.mocked(compartilharImagem);

function pedido(solicitacaoId: number, publicadorNome: string, criancaOuIdoso = false) {
  return { solicitacaoId, publicadorId: publicadorNome, publicadorNome, origem: 1, totalNaEscala: 1, criancaOuIdoso };
}

function celula(
  carrinhoId: number,
  diaSemana: number,
  turnoId: number,
  publicadores: unknown[],
  carrinhoDescricao: string | null = null,
) {
  return {
    carrinhoId,
    carrinhoNome: `Carrinho 0${carrinhoId}`,
    carrinhoDescricao,
    diaSemana,
    turnoId,
    disponivel: true,
    publicadores,
  };
}

// Turnos: 1 = 06–08, 2 = 08–10, 3 = 10–12. Quarta (3) do carrinho 1 está vazia; carrinho 3 inteiro vazio.
// O carrinho 1 vem fora de ordem de propósito (turno 3 antes do 2).
const GRADE = {
  mes: "2026-10",
  envio: null,
  celulas: [
    celula(1, 1, 3, [pedido(1, "Ana"), pedido(2, "Bia", true), pedido(3, "Caio")], "Em frente ao mercado"),
    celula(1, 1, 2, [pedido(4, "Dani")], "Em frente ao mercado"),
    celula(1, 2, 1, [], "Em frente ao mercado"),
    celula(1, 3, 1, [], "Em frente ao mercado"),
    celula(2, 5, 1, [pedido(5, "Edu"), pedido(6, "Fabi")]),
    celula(3, 1, 1, []),
  ],
};

function renderizar() {
  return render(
    <MemoryRouter initialEntries={["/admin/escalas/2026-10/compartilhar"]}>
      <Routes>
        <Route path="/admin/escalas/:mes/compartilhar" element={<EscalaCompartilhar />} />
        <Route path="/admin/escalas/:mes" element={<p>Tela da escala</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockApiFetch.mockReset();
  mockCompartilhar.mockReset();
  mockApiFetch.mockResolvedValue(structuredClone(GRADE));
});

describe("escalaParaCompartilhar", () => {
  it("descarta vagas, dias e carrinhos vazios e ordena dias e turnos", () => {
    const carrinhos = escalaParaCompartilhar(GRADE.celulas as never);

    expect(carrinhos.map((c) => c.carrinhoId)).toEqual([1, 2]);
    expect(carrinhos[0].dias.map((d) => d.rotulo)).toEqual(["Segunda-feira"]);
    expect(carrinhos[0].dias[0].turnos).toEqual([
      { turnoId: 2, nomes: ["Dani"] },
      { turnoId: 3, nomes: ["Ana", "Bia", "Caio"] },
    ]);
  });
});

describe("EscalaCompartilhar", () => {
  it("mostra cada carrinho com nome e descrição em destaque", async () => {
    renderizar();

    expect(await screen.findByRole("heading", { name: "Carrinho 01" })).toBeInTheDocument();
    expect(screen.getByText("Em frente ao mercado")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Carrinho 02" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Compartilhar escala" })).toBeInTheDocument();
  });

  it("não mostra dia, turno nem carrinho vazios", async () => {
    renderizar();
    await screen.findByRole("heading", { name: "Carrinho 01" });

    expect(screen.queryByRole("heading", { name: "Carrinho 03" })).not.toBeInTheDocument();
    expect(screen.queryByText("Terça-feira")).not.toBeInTheDocument();
    expect(screen.queryByText("Quarta-feira")).not.toBeInTheDocument();
    const carrinho1 = screen.getByRole("heading", { name: "Carrinho 01" }).closest("article")!;
    expect(within(carrinho1).queryByText("06:00–08:00")).not.toBeInTheDocument();
    expect(carrinho1.querySelectorAll("[data-turno]")).toHaveLength(2);
    expect(screen.getAllByText("Segunda-feira")).toHaveLength(1);
    expect(screen.getByText("Sexta-feira")).toBeInTheDocument();
  });

  it("lista os nomes de cada turno, sem marca de criança ou idoso", async () => {
    renderizar();
    await screen.findByRole("heading", { name: "Carrinho 01" });

    const turno = screen.getByText("Ana").closest("[data-turno]") as HTMLElement;
    expect(within(turno).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Ana", "Bia", "Caio"]);
    expect(screen.getByText("Dani")).toBeInTheDocument();
    expect(screen.getByText("Edu")).toBeInTheDocument();
    expect(screen.getByText("Fabi")).toBeInTheDocument();
    expect(screen.queryByText(/criança|idoso/i)).not.toBeInTheDocument();
  });

  it("é só leitura: sem ações de gestão", async () => {
    renderizar();
    await screen.findByRole("heading", { name: "Carrinho 01" });

    expect(screen.queryByRole("button", { name: /mover|excluir|editar|adicionar/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(2); // só "Compartilhar imagem", um por carrinho
  });

  it("compartilha a imagem do carrinho escolhido", async () => {
    mockCompartilhar.mockResolvedValue("compartilhado");
    renderizar();
    await screen.findByRole("heading", { name: "Carrinho 01" });

    await userEvent.click(screen.getByRole("button", { name: "Compartilhar imagem — Carrinho 02" }));

    expect(mockCompartilhar).toHaveBeenCalledTimes(1);
    const [elemento, arquivo, titulo] = mockCompartilhar.mock.calls[0];
    expect(within(elemento).getByRole("heading", { name: "Carrinho 02" })).toBeInTheDocument();
    expect(arquivo).toBe("escala-2026-10-carrinho-02");
    expect(titulo).toBe("Escala TPL — Carrinho 02 — Outubro de 2026");
  });

  it("avisa quando a imagem foi baixada em vez de compartilhada", async () => {
    mockCompartilhar.mockResolvedValue("baixado");
    renderizar();
    await screen.findByRole("heading", { name: "Carrinho 01" });

    await userEvent.click(screen.getByRole("button", { name: "Compartilhar imagem — Carrinho 01" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Imagem de Carrinho 01 baixada.");
  });

  it("mostra erro se não conseguir gerar a imagem", async () => {
    mockCompartilhar.mockRejectedValue(new Error("falhou"));
    renderizar();
    await screen.findByRole("heading", { name: "Carrinho 01" });

    await userEvent.click(screen.getByRole("button", { name: "Compartilhar imagem — Carrinho 01" }));

    expect(await screen.findByText(/não foi possível gerar a imagem/i)).toBeInTheDocument();
  });

  it("avisa quando não há nenhum pedido", async () => {
    mockApiFetch.mockResolvedValue({ mes: "2026-10", envio: null, celulas: [celula(1, 1, 1, [])] });
    renderizar();

    expect(await screen.findByText(/nenhum pedido em outubro de 2026/i)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("mostra erro se a escala não carregar", async () => {
    mockApiFetch.mockRejectedValue(new Error("rede"));
    renderizar();

    expect(await screen.findByText(/não foi possível carregar a escala/i)).toBeInTheDocument();
  });

  it("volta para a tela da escala", async () => {
    renderizar();
    await userEvent.click(await screen.findByRole("link", { name: /voltar à escala/i }));

    expect(screen.getByText("Tela da escala")).toBeInTheDocument();
  });
});
