import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client";
import { encerrarSessao, iniciarSessao, obterSessao, type Papel } from "../api/sessao";
import { reiniciarRenovacaoParaTestes } from "../api/renovacao";
import { ExigeLogin } from "./ExigeLogin";

vi.mock("../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/client")>()),
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

function TelaDeLogin() {
  const location = useLocation();
  return <p>Login (voltar para {(location.state as { from?: { pathname: string } } | null)?.from?.pathname})</p>;
}

function renderizar(caminho: string) {
  render(
    <MemoryRouter initialEntries={[caminho]}>
      <Routes>
        <Route path="/login" element={<TelaDeLogin />} />
        <Route path="/" element={<ExigeLogin><p>Início</p></ExigeLogin>} />
        <Route path="/solicitar" element={<ExigeLogin><p>Solicitar</p></ExigeLogin>} />
        <Route path="/admin" element={<ExigeLogin admin><p>Painel</p></ExigeLogin>} />
        <Route path="/admin/carrinhos" element={<ExigeLogin admin><p>Carrinhos</p></ExigeLogin>} />
      </Routes>
    </MemoryRouter>,
  );
}

function logar(papel: Papel) {
  iniciarSessao({ token: "jwt", papel });
}

beforeEach(() => {
  mockApiFetch.mockReset();
  mockApiFetch.mockResolvedValue({ token: "jwt-renovado", papel: "publicador" });
  reiniciarRenovacaoParaTestes();
});

describe("ExigeLogin", () => {
  it.each(["/", "/solicitar", "/admin/carrinhos"])("sem login, %s leva ao /login lembrando a página", (caminho) => {
    renderizar(caminho);

    expect(screen.getByText(`Login (voltar para ${caminho})`)).toBeInTheDocument();
  });

  it("logado, mostra a tela", () => {
    logar("publicador");
    renderizar("/solicitar");

    expect(screen.getByText("Solicitar")).toBeInTheDocument();
  });

  it("token recusado pela API (401) encerra a sessão e leva ao /login", () => {
    logar("publicador");
    renderizar("/solicitar");

    act(() => encerrarSessao());

    expect(screen.getByText("Login (voltar para /solicitar)")).toBeInTheDocument();
  });

  it("publicador comum não entra na área administrativa", () => {
    logar("publicador");
    renderizar("/admin/carrinhos");

    expect(screen.getByText("Início")).toBeInTheDocument();
  });

  it.each<Papel>(["administrador", "recuperacao"])("%s entra na área administrativa", (papel) => {
    logar(papel);
    renderizar("/admin/carrinhos");

    expect(screen.getByText("Carrinhos")).toBeInTheDocument();
  });

  it("administrador também usa as telas do publicador", () => {
    logar("administrador");
    renderizar("/solicitar");

    expect(screen.getByText("Solicitar")).toBeInTheDocument();
  });

  it("administrador de recuperação não pede vagas: vai à administração", () => {
    logar("recuperacao");
    renderizar("/solicitar");

    expect(screen.getByText("Painel")).toBeInTheDocument();
  });

  it("ao abrir o app, renova o token uma vez e guarda o novo", async () => {
    logar("publicador");
    renderizar("/");

    await vi.waitFor(() => expect(obterSessao()?.token).toBe("jwt-renovado"));
    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    expect(mockApiFetch).toHaveBeenCalledWith("/api/sessao/renovar", { method: "POST" });
  });

  it("o administrador de recuperação não renova", () => {
    logar("recuperacao");
    renderizar("/admin");

    expect(mockApiFetch).not.toHaveBeenCalled();
  });
});
