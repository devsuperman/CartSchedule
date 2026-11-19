import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, ApiError } from "../api/client";
import Login from "./Login";

vi.mock("../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/client")>()),
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

async function entrar({ de, usuario = "maria", pin = "2580" }: { de?: string; usuario?: string; pin?: string } = {}) {
  render(
    <MemoryRouter initialEntries={[{ pathname: "/login", state: de ? { from: { pathname: de } } : undefined }]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={<p>Painel</p>} />
        <Route path="/admin/publicadores" element={<p>Tela Publicadores</p>} />
      </Routes>
    </MemoryRouter>,
  );
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Usuário"), usuario);
  await user.type(screen.getByLabelText("PIN"), pin);
  await user.click(screen.getByRole("button", { name: "Entrar" }));
}

beforeEach(() => {
  mockApiFetch.mockReset();
  sessionStorage.clear();
});

describe("Login", () => {
  it("pede usuário e PIN (teclado numérico) e envia ao login único", async () => {
    mockApiFetch.mockRejectedValue(new ApiError(401, "x", { codigo: "CREDENCIAIS_INVALIDAS" }));

    await entrar();

    expect(screen.getByLabelText("PIN")).toHaveAttribute("inputmode", "numeric");
    expect(mockApiFetch).toHaveBeenCalledWith("/api/login", {
      method: "POST",
      body: JSON.stringify({ usuario: "maria", pin: "2580" }),
    });
  });

  it("administrador entra e vai ao painel", async () => {
    mockApiFetch.mockResolvedValue({ token: "jwt", papel: "administrador" });

    await entrar();

    expect(await screen.findByText("Painel")).toBeInTheDocument();
  });

  it("volta para a página que pedia login", async () => {
    mockApiFetch.mockResolvedValue({ token: "jwt", papel: "recuperacao" });

    await entrar({ de: "/admin/publicadores" });

    expect(await screen.findByText("Tela Publicadores")).toBeInTheDocument();
  });

  it("usuário ou PIN errados mostra a mensagem sem dizer qual dos dois", async () => {
    mockApiFetch.mockRejectedValue(
      new ApiError(401, "Usuário ou PIN inválidos.", { codigo: "CREDENCIAIS_INVALIDAS" }),
    );

    await entrar();

    expect(await screen.findByText("Usuário ou PIN inválidos.")).toBeInTheDocument();
  });

  it("publicador sem marca de administrador ainda não tem o que acessar", async () => {
    mockApiFetch.mockResolvedValue({ token: "jwt", papel: "publicador" });

    await entrar();

    expect(await screen.findByText(/só administradores/i)).toBeInTheDocument();
    expect(screen.queryByText("Painel")).not.toBeInTheDocument();
  });

  it("depois de muitas tentativas (429), pede para aguardar", async () => {
    mockApiFetch.mockRejectedValue(
      new ApiError(429, "Muitas tentativas. Aguarde um pouco e tente novamente.", { codigo: "MUITAS_REQUISICOES" }),
    );

    await entrar();

    expect(await screen.findByText("Muitas tentativas. Aguarde um pouco e tente novamente.")).toBeInTheDocument();
  });
});
