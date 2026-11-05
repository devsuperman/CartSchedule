import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../../api/client";
import { compartilharImagem } from "../../utils/imagemEscala";
import EscalaCompartilhar from "./EscalaCompartilhar";

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
  carrinhoDataEspecial: string | null = null,
) {
  return {
    carrinhoId,
    carrinhoNome: `Carrinho 0${carrinhoId}`,
    carrinhoDescricao,
    carrinhoDataEspecial,
    diaSemana,
    turnoId,
    disponivel: true,
    publicadores,
  };
}

// Turnos: 1 = 06–08, 2 = 08–10, 3 = 10–12. Terça e Quarta vazias; carrinho 3 inteiro vazio.
// Vem fora de ordem de propósito (turno 3 antes do 2, carrinho 2 antes do 1).
// Carrinho 9 é de data especial (quarta, 21/10): imagem própria, fora da imagem do mês.
const GRADE = {
  mes: "2026-10",
  envio: null,
  celulas: [
    celula(2, 1, 3, [pedido(7, "Gil")]),
    celula(1, 1, 3, [pedido(1, "Ana"), pedido(2, "Bia", true), pedido(3, "Caio")], "Em frente ao mercado"),
    celula(1, 1, 2, [pedido(4, "Dani")], "Em frente ao mercado"),
    celula(1, 2, 1, [], "Em frente ao mercado"),
    celula(1, 3, 1, [], "Em frente ao mercado"),
    celula(2, 5, 1, [pedido(5, "Edu"), pedido(6, "Fabi")]),
    celula(3, 1, 1, []),
    celula(9, 3, 2, [pedido(8, "Hugo")], null, "2026-10-21"),
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

async function imagemDoMes() {
  return (await screen.findByRole("heading", { name: "Segunda-feira" })).closest("article") as HTMLElement;
}

function textos(elementos: Element[]) {
  return elementos.map((e) => e.textContent);
}

beforeEach(() => {
  mockApiFetch.mockReset();
  mockCompartilhar.mockReset();
  mockApiFetch.mockResolvedValue(structuredClone(GRADE));
});

describe("EscalaCompartilhar", () => {
  it("monta uma grade do mês por dia → turno, com os carrinhos nas colunas e só o que tem gente", async () => {
    renderizar();
    const mes = await imagemDoMes();

    expect(textos(within(mes).getAllByRole("heading", { level: 3 }))).toEqual(["Segunda-feira", "Sexta-feira"]);
    const segunda = within(mes).getAllByRole("table")[0];
    expect(textos(within(segunda).getAllByRole("columnheader"))).toEqual([
      "Horário",
      "Carrinho 01Em frente ao mercado",
      "Carrinho 02",
    ]);
    expect(textos(within(segunda).getAllByRole("rowheader"))).toEqual(["08:00–10:00", "10:00–12:00"]);
    const [, linhaDas10] = within(segunda).getAllByRole("row").slice(1);
    expect(textos(within(linhaDas10).getAllByRole("cell"))).toEqual(["AnaBiaCaio", "Gil"]);
    // Carrinho 01 não tem ninguém na sexta, mas a coluna continua no mesmo lugar, em branco.
    const sexta = within(mes).getAllByRole("table")[1];
    expect(textos(within(sexta).getAllByRole("cell"))).toEqual(["", "EduFabi"]);
    expect(within(mes).queryByText("Carrinho 03")).not.toBeInTheDocument();
    expect(within(mes).queryByText(/Terça|Quarta/)).not.toBeInTheDocument();
    expect(within(mes).queryByText("06:00–08:00", { selector: "th" })).toBeInTheDocument();
  });

  it("mostra a descrição do carrinho, sem marca de criança ou idoso", async () => {
    renderizar();
    const mes = await imagemDoMes();

    expect(within(mes).getAllByText("Em frente ao mercado")).toHaveLength(2); // um cabeçalho por dia
    expect(screen.queryByText(/criança|idoso/i)).not.toBeInTheDocument();
  });

  it("põe o carrinho de data especial numa imagem separada", async () => {
    renderizar();
    const mes = await imagemDoMes();

    expect(within(mes).queryByText("Hugo")).not.toBeInTheDocument();
    const especial = screen.getByRole("heading", { name: "Quarta-feira, 21/10" }).closest("article") as HTMLElement;
    expect(within(especial).getByText("Somente nesta data")).toBeInTheDocument();
    expect(within(especial).getByRole("columnheader", { name: "Carrinho 09" })).toBeInTheDocument();
    expect(within(especial).getByRole("rowheader", { name: "08:00–10:00" })).toBeInTheDocument();
    expect(within(especial).getByRole("cell", { name: "Hugo" })).toBeInTheDocument();
  });

  it("é só leitura: um botão de compartilhar por imagem e nenhuma ação de gestão", async () => {
    renderizar();
    await imagemDoMes();

    expect(screen.queryByRole("button", { name: /mover|excluir|editar|adicionar/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual([
      "Compartilhar imagem — Outubro de 2026",
      "Compartilhar imagem — Quarta-feira, 21/10",
    ]);
  });

  it("compartilha a imagem do mês", async () => {
    mockCompartilhar.mockResolvedValue("compartilhado");
    renderizar();
    await imagemDoMes();

    await userEvent.click(screen.getByRole("button", { name: "Compartilhar imagem — Outubro de 2026" }));

    expect(mockCompartilhar).toHaveBeenCalledTimes(1);
    const [elemento, arquivo, titulo] = mockCompartilhar.mock.calls[0];
    expect(within(elemento).getByRole("heading", { name: "Segunda-feira" })).toBeInTheDocument();
    expect(arquivo).toBe("escala-2026-10");
    expect(titulo).toBe("Escala TPL — Outubro de 2026");
  });

  it("compartilha a imagem da data especial", async () => {
    mockCompartilhar.mockResolvedValue("compartilhado");
    renderizar();
    await imagemDoMes();

    await userEvent.click(screen.getByRole("button", { name: "Compartilhar imagem — Quarta-feira, 21/10" }));

    const [elemento, arquivo, titulo] = mockCompartilhar.mock.calls[0];
    expect(within(elemento).getByText("Hugo")).toBeInTheDocument();
    expect(arquivo).toBe("escala-2026-10-21");
    expect(titulo).toBe("Escala TPL — Quarta-feira, 21/10");
  });

  it("só gera a imagem da data especial quando o mês não tem escala semanal", async () => {
    mockApiFetch.mockResolvedValue({ mes: "2026-10", envio: null, celulas: [GRADE.celulas.at(-1)] });
    renderizar();

    expect(await screen.findByRole("heading", { name: "Quarta-feira, 21/10" })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("avisa quando a imagem foi baixada em vez de compartilhada", async () => {
    mockCompartilhar.mockResolvedValue("baixado");
    renderizar();
    await imagemDoMes();

    await userEvent.click(screen.getByRole("button", { name: "Compartilhar imagem — Outubro de 2026" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Imagem de Outubro de 2026 baixada.");
  });

  it("mostra erro se não conseguir gerar a imagem", async () => {
    mockCompartilhar.mockRejectedValue(new Error("falhou"));
    renderizar();
    await imagemDoMes();

    await userEvent.click(screen.getByRole("button", { name: "Compartilhar imagem — Outubro de 2026" }));

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
