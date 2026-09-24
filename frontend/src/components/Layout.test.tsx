import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, PUBLICADOR_NOME_STORAGE_KEY } from "../api/client";
import { usePublicadorToken } from "../hooks/usePublicadorToken";
import { Layout } from "./Layout";

vi.mock("../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/client")>()),
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

beforeEach(() => {
  mockApiFetch.mockReset();
  mockApiFetch.mockResolvedValue({ aberta: true, mesAlvo: "2026-10-01" });
});

function MostraEstado() {
  const location = useLocation();
  return <p>Origem: {(location.state as { de?: string } | null)?.de}</p>;
}

function TelaQueTrocaONome() {
  const { setNome } = usePublicadorToken();
  return (
    <button type="button" onClick={() => setNome("Maria Souza")}>
      Trocar nome
    </button>
  );
}

function renderizar(caminho = "/") {
  render(
    <MemoryRouter initialEntries={[caminho]}>
      <Layout>
        <Routes>
          <Route path="/" element={<TelaQueTrocaONome />} />
          <Route path="/nome" element={<MostraEstado />} />
          <Route path="/admin" element={<p>Admin</p>} />
        </Routes>
      </Layout>
    </MemoryRouter>,
  );
  return userEvent.setup();
}

describe("Layout — Olá, Fulano", () => {
  it("mostra só o primeiro nome e leva à edição lembrando a tela de origem", async () => {
    localStorage.setItem(PUBLICADOR_NOME_STORAGE_KEY, "João da Silva");
    const user = renderizar();

    const link = screen.getByRole("link", { name: /Olá, João/ });
    expect(link).toHaveTextContent("Olá, João");
    expect(link).not.toHaveTextContent("Silva");

    await user.click(link);
    expect(screen.getByText("Origem: /")).toBeInTheDocument();
  });

  it("atualiza na hora quando o nome muda em outra tela", async () => {
    localStorage.setItem(PUBLICADOR_NOME_STORAGE_KEY, "Joao");
    const user = renderizar();

    await user.click(screen.getByRole("button", { name: "Trocar nome" }));

    expect(screen.getByRole("link", { name: /Olá, Maria/ })).toBeInTheDocument();
  });

  it("não aparece sem nome salvo", () => {
    renderizar();
    expect(screen.queryByRole("link", { name: /Olá/ })).not.toBeInTheDocument();
  });

  it.each(["/nome", "/admin"])("não aparece em %s", (caminho) => {
    localStorage.setItem(PUBLICADOR_NOME_STORAGE_KEY, "Ana");
    renderizar(caminho);
    expect(screen.queryByRole("link", { name: /Olá/ })).not.toBeInTheDocument();
  });
});
