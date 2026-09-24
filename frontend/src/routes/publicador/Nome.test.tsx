import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, ApiError, PUBLICADOR_NOME_STORAGE_KEY } from "../../api/client";
import Nome from "./Nome";

vi.mock("../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/client")>()),
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

beforeEach(() => {
  mockApiFetch.mockReset();
  mockApiFetch.mockResolvedValue(undefined);
});

function renderizar(estado?: { de: string }) {
  render(
    <MemoryRouter initialEntries={[{ pathname: "/nome", state: estado }]}>
      <Routes>
        <Route path="/nome" element={<Nome />} />
        <Route path="/" element={<p>Tela inicial</p>} />
        <Route path="/solicitar" element={<p>Wizard</p>} />
      </Routes>
    </MemoryRouter>,
  );
  return userEvent.setup();
}

describe("Nome — primeiro acesso", () => {
  it("pergunta o nome, salva no aparelho e segue para a tela inicial sem chamar o servidor", async () => {
    const user = renderizar();

    expect(screen.getByRole("heading", { name: "Qual é o seu nome?" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar" })).not.toBeInTheDocument();
    const campo = screen.getByRole("textbox", { name: "Seu nome" });
    expect(campo).toHaveAttribute("placeholder", "Nome e sobrenome");

    await user.type(campo, "  João Silva ");
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(screen.getByText("Tela inicial")).toBeInTheDocument();
    expect(localStorage.getItem(PUBLICADOR_NOME_STORAGE_KEY)).toBe("João Silva");
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it("não deixa continuar com o nome vazio ou só com espaços", async () => {
    const user = renderizar();

    expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled();
    await user.type(screen.getByRole("textbox", { name: "Seu nome" }), "   ");
    expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled();
  });
});

describe("Nome — edição", () => {
  beforeEach(() => {
    localStorage.setItem(PUBLICADOR_NOME_STORAGE_KEY, "Joao");
  });

  it("vem preenchido, salva no servidor e volta para a tela de origem", async () => {
    const user = renderizar({ de: "/solicitar" });

    expect(screen.getByRole("heading", { name: "Alterar nome" })).toBeInTheDocument();
    const campo = screen.getByRole("textbox", { name: "Seu nome" });
    expect(campo).toHaveValue("Joao");

    await user.clear(campo);
    await user.type(campo, "João");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(mockApiFetch).toHaveBeenCalledWith("/api/publicador", {
      method: "PUT",
      body: JSON.stringify({ nome: "João" }),
    });
    expect(await screen.findByText("Wizard")).toBeInTheDocument();
    expect(localStorage.getItem(PUBLICADOR_NOME_STORAGE_KEY)).toBe("João");
  });

  it("se o servidor falhar, avisa e continua na tela", async () => {
    mockApiFetch.mockRejectedValue(new ApiError(429, "Muitas requisições"));
    const user = renderizar({ de: "/" });

    await user.type(screen.getByRole("textbox", { name: "Seu nome" }), " Silva");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Não foi possível salvar agora. Tente de novo.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Alterar nome" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar" })).toBeEnabled();
  });

  it("Cancelar volta sem salvar", async () => {
    const user = renderizar({ de: "/" });

    await user.type(screen.getByRole("textbox", { name: "Seu nome" }), "xyz");
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.getByText("Tela inicial")).toBeInTheDocument();
    expect(localStorage.getItem(PUBLICADOR_NOME_STORAGE_KEY)).toBe("Joao");
    expect(mockApiFetch).not.toHaveBeenCalled();
  });
});
