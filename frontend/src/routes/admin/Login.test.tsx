import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, ApiError } from "../../api/client";
import Login from "./Login";

vi.mock("../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/client")>()),
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

async function entrar() {
  render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  );
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Usuário"), "admin");
  await user.type(screen.getByLabelText("Senha"), "errada");
  await user.click(screen.getByRole("button", { name: "Entrar" }));
}

beforeEach(() => {
  mockApiFetch.mockReset();
});

describe("Login do administrador", () => {
  it("senha errada mostra usuário ou senha inválidos", async () => {
    mockApiFetch.mockRejectedValue(new ApiError(401, "Usuário ou senha inválidos."));

    await entrar();

    expect(await screen.findByText("Usuário ou senha inválidos.")).toBeInTheDocument();
  });

  it("depois de muitas tentativas (429), pede para aguardar", async () => {
    mockApiFetch.mockRejectedValue(
      new ApiError(429, "Muitas tentativas. Aguarde um pouco e tente novamente.", { codigo: "MUITAS_REQUISICOES" }),
    );

    await entrar();

    expect(await screen.findByText("Muitas tentativas. Aguarde um pouco e tente novamente.")).toBeInTheDocument();
  });
});
