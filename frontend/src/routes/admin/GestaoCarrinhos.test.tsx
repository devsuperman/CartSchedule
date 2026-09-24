import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../../api/client";
import GestaoCarrinhos from "./GestaoCarrinhos";

vi.mock("../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/client")>()),
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

beforeEach(() => {
  mockApiFetch.mockReset();
  mockApiFetch.mockImplementation(async (path, opcoes) => {
    if (path === "/api/admin/carrinhos") {
      return [
        { id: 1, nome: "Carrinho 01", descricao: null, ativo: true, disponibilidades: [{ diaSemana: 1, turnoId: 2 }] },
        { id: 2, nome: "Carrinho 02", descricao: null, ativo: true, disponibilidades: [] },
      ];
    }
    const turnos = /^\/api\/admin\/carrinhos\/(\d+)\/turnos$/.exec(path);
    if (turnos && opcoes?.method === "PUT") {
      return { carrinhoId: Number(turnos[1]), ...JSON.parse(opcoes.body as string) };
    }
    throw new Error(`chamada inesperada: ${path}`);
  });
  render(<GestaoCarrinhos />);
});

async function cardDoCarrinho(nome: string) {
  const titulo = await screen.findByRole("heading", { name: nome });
  return within(titulo.closest("li")!);
}

function corpoDoPut(carrinhoId: number) {
  const chamada = mockApiFetch.mock.calls.findLast(([path]) => path === `/api/admin/carrinhos/${carrinhoId}/turnos`);
  return JSON.parse(chamada![1]!.body as string);
}

describe("GestaoCarrinhos — grade dia × turno", () => {
  it("marca as células que o carrinho já tem", async () => {
    const card = await cardDoCarrinho("Carrinho 01");

    expect(card.getByRole("button", { name: "Segunda-feira 08:00–10:00" })).toHaveAttribute("aria-pressed", "true");
    expect(card.getByRole("button", { name: "Terça-feira 08:00–10:00" })).toHaveAttribute("aria-pressed", "false");
  });

  it("ligar uma célula envia o conjunto inteiro com o novo par (dia, turno)", async () => {
    const user = userEvent.setup();
    const card = await cardDoCarrinho("Carrinho 01");

    await user.click(card.getByRole("button", { name: "Terça-feira 10:00–12:00" }));

    await waitFor(() =>
      expect(card.getByRole("button", { name: "Terça-feira 10:00–12:00" })).toHaveAttribute("aria-pressed", "true"),
    );
    expect(corpoDoPut(1)).toEqual({
      disponibilidades: [
        { diaSemana: 1, turnoId: 2 },
        { diaSemana: 2, turnoId: 3 },
      ],
    });
  });

  it("desligar uma célula remove só aquele dia", async () => {
    const user = userEvent.setup();
    const card = await cardDoCarrinho("Carrinho 01");

    await user.click(card.getByRole("button", { name: "Segunda-feira 08:00–10:00" }));

    await waitFor(() =>
      expect(card.getByRole("button", { name: "Segunda-feira 08:00–10:00" })).toHaveAttribute("aria-pressed", "false"),
    );
    expect(corpoDoPut(1)).toEqual({ disponibilidades: [] });
  });

  it("avisa quando um carrinho ativo não tem nenhum turno, e o aviso some ao marcar um", async () => {
    const user = userEvent.setup();
    const semTurno = await cardDoCarrinho("Carrinho 02");
    const comTurno = await cardDoCarrinho("Carrinho 01");

    expect(semTurno.getByText(/não aparece para os publicadores/)).toBeInTheDocument();
    expect(comTurno.queryByText(/não aparece para os publicadores/)).not.toBeInTheDocument();

    await user.click(semTurno.getByRole("button", { name: "Sexta-feira 06:00–08:00" }));

    await waitFor(() => expect(semTurno.queryByText(/não aparece para os publicadores/)).not.toBeInTheDocument());
  });
});
