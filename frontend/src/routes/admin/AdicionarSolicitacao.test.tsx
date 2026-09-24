import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../../api/client";
import AdicionarSolicitacao from "./AdicionarSolicitacao";

vi.mock("../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/client")>()),
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

beforeEach(() => {
  mockApiFetch.mockReset();
  mockApiFetch.mockImplementation(async (path) => {
    if (path === "/api/carrinhos") {
      return [
        {
          id: 1,
          nome: "Carrinho 01",
          descricao: null,
          disponibilidades: [
            { diaSemana: 1, turnoId: 2 },
            { diaSemana: 2, turnoId: 3 },
          ],
        },
      ];
    }
    throw new Error(`chamada inesperada: ${path}`);
  });
});

async function renderTela() {
  render(
    <MemoryRouter initialEntries={["/admin/adicionar/2026-10"]}>
      <Routes>
        <Route path="/admin/adicionar/:mes" element={<AdicionarSolicitacao />} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByRole("combobox", { name: /Carrinho/ });
  return userEvent.setup();
}

async function escolher(user: ReturnType<typeof userEvent.setup>, campo: RegExp, opcao: string) {
  await user.click(screen.getByRole("combobox", { name: campo }));
  await user.click(await screen.findByRole("option", { name: opcao }));
}

async function opcoesDeTurno(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("combobox", { name: /Turno/ }));
  const opcoes = (await screen.findAllByRole("option")).map((o) => o.textContent);
  await user.keyboard("{Escape}");
  return opcoes;
}

describe("AdicionarSolicitacao — turnos por carrinho e dia", () => {
  it("só libera o turno depois de escolher carrinho e dia", async () => {
    const user = await renderTela();

    expect(screen.getByRole("combobox", { name: /Turno/ })).toBeDisabled();
    await escolher(user, /Carrinho/, "Carrinho 01");
    expect(screen.getByRole("combobox", { name: /Turno/ })).toBeDisabled();
    await escolher(user, /Dia da semana/, "Segunda-feira");
    expect(screen.getByRole("combobox", { name: /Turno/ })).toBeEnabled();
  });

  it("oferece só os turnos do carrinho no dia escolhido e limpa o turno ao trocar o dia", async () => {
    const user = await renderTela();
    await escolher(user, /Carrinho/, "Carrinho 01");
    await escolher(user, /Dia da semana/, "Segunda-feira");

    expect(await opcoesDeTurno(user)).toEqual(["08:00–10:00"]);
    await escolher(user, /Turno/, "08:00–10:00");

    await escolher(user, /Dia da semana/, "Terça-feira");

    expect(screen.getByRole("combobox", { name: /Turno/ })).toHaveTextContent("Selecione um turno");
    expect(await opcoesDeTurno(user)).toEqual(["10:00–12:00"]);
  });

  it("dia sem turno no carrinho deixa o campo de turno bloqueado com aviso", async () => {
    const user = await renderTela();
    await escolher(user, /Carrinho/, "Carrinho 01");
    await escolher(user, /Dia da semana/, "Quarta-feira");

    const turno = screen.getByRole("combobox", { name: /Turno/ });
    expect(turno).toBeDisabled();
    expect(turno).toHaveTextContent("Nenhum turno neste carrinho nesse dia");
  });
});
