import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, ApiError } from "../../api/client";
import RevisaoEscala from "./RevisaoEscala";

vi.mock("../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/client")>()),
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

function pedido(id: number, publicadorId: string, publicadorNome: string, totalNaEscala: number) {
  return { id, publicadorId, publicadorNome, origem: 1, criadoEm: "2026-09-20T10:00:00Z", totalNaEscala };
}

// Ana tem 2 pedidos na escala: um no grupo excedente e outro sozinho em outra vaga.
const RESPOSTA = {
  mes: "2026-10",
  grupos: [
    {
      carrinhoId: 1,
      carrinhoNome: "Carrinho 01",
      diaSemana: 1,
      turnoId: 2,
      excedente: true,
      solicitacoes: [pedido(1, "ana", "Ana", 2), pedido(2, "bia", "Bia", 1), pedido(3, "caio", "Caio", 1)],
    },
    {
      carrinhoId: 1,
      carrinhoNome: "Carrinho 01",
      diaSemana: 2,
      turnoId: 3,
      excedente: false,
      solicitacoes: [pedido(4, "ana", "Ana", 2)],
    },
  ],
};

beforeEach(() => {
  mockApiFetch.mockReset();
  mockApiFetch.mockImplementation(async (path, init) => {
    if (path === "/api/admin/escalas/2026-10/solicitacoes") return structuredClone(RESPOSTA);
    if (init?.method === "DELETE" || init?.method === "PUT") return undefined;
    throw new Error(`chamada inesperada: ${path}`);
  });
});

async function renderTela() {
  render(
    <MemoryRouter initialEntries={["/admin/revisao/2026-10"]}>
      <Routes>
        <Route path="/admin/revisao/:mes" element={<RevisaoEscala />} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByRole("heading", { name: "Revisão da escala" });
  return userEvent.setup();
}

function linhaDe(nome: string, indice = 0) {
  return screen.getAllByText(nome)[indice].closest("li")!;
}

describe("RevisaoEscala", () => {
  it("não tem aprovação: nem status, nem botões Aprovar/Rejeitar", async () => {
    await renderTela();

    expect(screen.queryByRole("button", { name: "Aprovar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rejeitar" })).not.toBeInTheDocument();
    expect(screen.queryByText("Pendentes")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Excluir" })).toHaveLength(4);
    expect(screen.getByText("3 pedidos para 2 vagas")).toBeInTheDocument();
  });

  it("Excluir pede confirmação e Cancelar não apaga nada", async () => {
    const user = await renderTela();

    await user.click(within(linhaDe("Bia")).getByRole("button", { name: "Excluir" }));
    const dialogo = screen.getByRole("dialog");
    expect(within(dialogo).getByRole("heading", { name: "Excluir pedido?" })).toBeInTheDocument();
    expect(dialogo).toHaveTextContent("Bia — Carrinho 01, Segunda-feira, 08:00–10:00");

    await user.click(within(dialogo).getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mockApiFetch).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ method: "DELETE" }));
    expect(screen.getByText("Bia")).toBeInTheDocument();
  });

  it("confirmar exclui, some com a linha e o grupo deixa de ser excedente", async () => {
    const user = await renderTela();

    await user.click(within(linhaDe("Bia")).getByRole("button", { name: "Excluir" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Excluir" }));

    expect(mockApiFetch).toHaveBeenCalledWith("/api/admin/solicitacoes/2", { method: "DELETE" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Bia")).not.toBeInTheDocument();
    expect(screen.queryByText(/pedidos para 2 vagas/)).not.toBeInTheDocument();
  });

  it("excluir atualiza a contagem do publicador e remove o grupo que ficou vazio", async () => {
    const user = await renderTela();

    // O segundo "Ana" é o pedido sozinho na Terça.
    await user.click(within(linhaDe("Ana", 1)).getByRole("button", { name: "Excluir" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Excluir" }));

    expect(mockApiFetch).toHaveBeenCalledWith("/api/admin/solicitacoes/4", { method: "DELETE" });
    expect(screen.getAllByText("Ana")).toHaveLength(1);
    expect(screen.queryByText(/Terça-feira/)).not.toBeInTheDocument();
    expect(linhaDe("Ana")).toHaveTextContent("1 pedido nesta escala");
  });

  it("mostra o erro da API na linha e mantém o pedido", async () => {
    mockApiFetch.mockImplementation(async (path, init) => {
      if (path === "/api/admin/escalas/2026-10/solicitacoes") return structuredClone(RESPOSTA);
      if (init?.method === "DELETE") throw new ApiError(404, "Solicitação não encontrada.");
      throw new Error(`chamada inesperada: ${path}`);
    });
    const user = await renderTela();

    await user.click(within(linhaDe("Bia")).getByRole("button", { name: "Excluir" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Excluir" }));

    expect(within(linhaDe("Bia")).getByText("Solicitação não encontrada.")).toBeInTheDocument();
  });

  describe("editar nome", () => {
    it("o lápis abre o modal preenchido; salvar renomeia todas as linhas do publicador", async () => {
      const user = await renderTela();

      await user.click(screen.getAllByRole("button", { name: "Editar nome de Ana" })[0]);
      const dialogo = screen.getByRole("dialog");
      expect(within(dialogo).getByRole("heading", { name: "Editar nome" })).toBeInTheDocument();
      expect(dialogo).toHaveTextContent("Muda o nome em todos os pedidos desta pessoa.");
      const campo = within(dialogo).getByRole("textbox", { name: "Nome do publicador" });
      expect(campo).toHaveValue("Ana");

      await user.clear(campo);
      await user.type(campo, "Ana Souza");
      await user.click(within(dialogo).getByRole("button", { name: "Salvar" }));

      expect(mockApiFetch).toHaveBeenCalledWith("/api/admin/publicadores/ana", {
        method: "PUT",
        body: JSON.stringify({ nome: "Ana Souza" }),
      });
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.getAllByText("Ana Souza")).toHaveLength(2);
      expect(screen.queryByText("Ana")).not.toBeInTheDocument();
    });

    it("Cancelar não chama a API", async () => {
      const user = await renderTela();

      await user.click(screen.getByRole("button", { name: "Editar nome de Bia" }));
      await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" }));

      expect(mockApiFetch).not.toHaveBeenCalledWith(expect.stringContaining("/publicadores/"), expect.anything());
      expect(screen.getByText("Bia")).toBeInTheDocument();
    });

    it("erro da API aparece dentro do modal", async () => {
      mockApiFetch.mockImplementation(async (path, init) => {
        if (path === "/api/admin/escalas/2026-10/solicitacoes") return structuredClone(RESPOSTA);
        if (init?.method === "PUT") throw new ApiError(404, "Publicador não encontrado.");
        throw new Error(`chamada inesperada: ${path}`);
      });
      const user = await renderTela();

      await user.click(screen.getByRole("button", { name: "Editar nome de Bia" }));
      const dialogo = screen.getByRole("dialog");
      await user.type(within(dialogo).getByRole("textbox", { name: "Nome do publicador" }), "trix");
      await user.click(within(dialogo).getByRole("button", { name: "Salvar" }));

      expect(await within(dialogo).findByText("Publicador não encontrado.")).toBeInTheDocument();
      expect(screen.getByText("Bia")).toBeInTheDocument();
    });
  });
});
