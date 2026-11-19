import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, ApiError } from "../../api/client";
import Publicadores from "./Publicadores";

vi.mock("../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/client")>()),
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

const LISTA = [
  { id: "a", nome: "Ana Paula", usuario: "aninha", criancaOuIdoso: false, administrador: true, ativo: true, temPin: true },
  { id: "j", nome: "José Lima", usuario: null, criancaOuIdoso: true, administrador: false, ativo: true, temPin: false },
];

beforeEach(() => {
  mockApiFetch.mockReset();
  mockApiFetch.mockImplementation(async (path, opcoes) => {
    if (path === "/api/admin/publicadores" && !opcoes?.method) return LISTA;
    throw new Error(`chamada inesperada: ${path}`);
  });
});

function renderizar() {
  render(<Publicadores />);
  return userEvent.setup();
}

function corpoDa(path: string, metodo: string) {
  const chamada = mockApiFetch.mock.calls.findLast(([p, o]) => p === path && o?.method === metodo);
  return JSON.parse(chamada![1]!.body as string);
}

async function itemDe(nome: string) {
  return within((await screen.findByText(nome)).closest("li")!);
}

describe("Publicadores", () => {
  it("lista com usuário, marcas e quem ainda não tem usuário", async () => {
    renderizar();

    const ana = await itemDe("Ana Paula");
    expect(ana.getByText("aninha")).toBeInTheDocument();
    expect(ana.getByText("Administrador")).toBeInTheDocument();
    const jose = await itemDe("José Lima");
    expect(jose.getByText("Sem usuário")).toBeInTheDocument();
    expect(jose.getByText("Criança ou idoso")).toBeInTheDocument();
  });

  it("busca por nome ou usuário sem diferenciar acentos", async () => {
    const user = renderizar();
    await screen.findByText("Ana Paula");

    await user.type(screen.getByRole("searchbox", { name: "Buscar publicador" }), "jose");

    expect(screen.getByText("José Lima")).toBeInTheDocument();
    expect(screen.queryByText("Ana Paula")).not.toBeInTheDocument();

    await user.clear(screen.getByRole("searchbox", { name: "Buscar publicador" }));
    await user.type(screen.getByRole("searchbox", { name: "Buscar publicador" }), "ANINHA");
    expect(screen.getByText("Ana Paula")).toBeInTheDocument();
    expect(screen.queryByText("José Lima")).not.toBeInTheDocument();
  });

  it("cria com usuário = primeiro nome e mostra o PIN uma vez, com copiar mensagem", async () => {
    mockApiFetch.mockImplementation(async (path, opcoes) => {
      if (path === "/api/admin/publicadores" && !opcoes?.method) return LISTA;
      if (path === "/api/admin/publicadores" && opcoes?.method === "POST") {
        return { id: "m", usuario: "Maria", pin: "2580" };
      }
      throw new Error(`chamada inesperada: ${path}`);
    });
    const user = renderizar();
    await screen.findByText("Ana Paula");

    await user.click(screen.getByRole("button", { name: "Novo publicador" }));
    const dialogo = within(screen.getByRole("dialog"));
    await user.type(dialogo.getByLabelText("Nome"), "Maria Souza");
    expect(dialogo.getByLabelText("Usuário")).toHaveValue("Maria");
    await user.click(dialogo.getByRole("checkbox", { name: /Criança ou idoso/ }));
    await user.click(dialogo.getByRole("button", { name: "Criar" }));

    expect(corpoDa("/api/admin/publicadores", "POST")).toEqual({
      nome: "Maria Souza",
      usuario: "Maria",
      criancaOuIdoso: true,
      administrador: false,
    });
    const pin = within(await screen.findByRole("dialog", { name: "Acesso de Maria Souza" }));
    expect(pin.getByText("2580")).toBeInTheDocument();

    await user.click(pin.getByRole("button", { name: "Copiar mensagem" }));
    const copiada = await navigator.clipboard.readText();
    expect(copiada).toContain(window.location.origin);
    expect(copiada).toContain("Usuário: Maria");
    expect(copiada).toContain("PIN: 2580");
    expect(pin.getByRole("button", { name: "Mensagem copiada" })).toBeInTheDocument();

    await user.click(pin.getByRole("button", { name: "Pronto" }));
    expect(screen.queryByText("2580")).not.toBeInTheDocument();
    expect(await itemDe("Maria Souza")).toBeTruthy();
  });

  it("usuário já em uso mostra o aviso do servidor e mantém o formulário", async () => {
    mockApiFetch.mockImplementation(async (path, opcoes) => {
      if (path === "/api/admin/publicadores" && !opcoes?.method) return LISTA;
      throw new ApiError(409, "Este usuário já está em uso. Escolha outro (ex: MariaS).", { codigo: "USUARIO_EM_USO" });
    });
    const user = renderizar();
    await screen.findByText("Ana Paula");

    await user.click(screen.getByRole("button", { name: "Novo publicador" }));
    const dialogo = within(screen.getByRole("dialog"));
    await user.type(dialogo.getByLabelText("Nome"), "Maria");
    await user.click(dialogo.getByRole("button", { name: "Criar" }));

    expect(await dialogo.findByText("Este usuário já está em uso. Escolha outro (ex: MariaS).")).toBeInTheDocument();
    expect(dialogo.getByLabelText("Nome")).toHaveValue("Maria");
  });

  it("edita nome, usuário e marcas", async () => {
    mockApiFetch.mockImplementation(async (path, opcoes) => {
      if (path === "/api/admin/publicadores" && !opcoes?.method) return LISTA;
      if (path === "/api/admin/publicadores/a" && opcoes?.method === "PUT") return undefined;
      throw new Error(`chamada inesperada: ${path}`);
    });
    const user = renderizar();

    await user.click((await itemDe("Ana Paula")).getByRole("button", { name: "Editar Ana Paula" }));
    const dialogo = within(screen.getByRole("dialog"));
    expect(dialogo.getByLabelText("Usuário")).toHaveValue("aninha");
    await user.clear(dialogo.getByLabelText("Nome"));
    await user.type(dialogo.getByLabelText("Nome"), "Ana P. Souza");
    await user.click(dialogo.getByRole("checkbox", { name: /Administrador/ }));
    await user.click(dialogo.getByRole("button", { name: "Salvar" }));

    expect(corpoDa("/api/admin/publicadores/a", "PUT")).toEqual({
      nome: "Ana P. Souza",
      usuario: "aninha",
      criancaOuIdoso: false,
      administrador: false,
    });
    const ana = await itemDe("Ana P. Souza");
    expect(ana.queryByText("Administrador")).not.toBeInTheDocument();
  });

  it("dar usuário a um registro antigo cria o acesso e mostra o PIN", async () => {
    mockApiFetch.mockImplementation(async (path, opcoes) => {
      if (path === "/api/admin/publicadores" && !opcoes?.method) return LISTA;
      if (path === "/api/admin/publicadores/j" && opcoes?.method === "PUT") {
        return { id: "j", usuario: "jose", pin: "7351" };
      }
      throw new Error(`chamada inesperada: ${path}`);
    });
    const user = renderizar();

    await user.click((await itemDe("José Lima")).getByRole("button", { name: "Editar José Lima" }));
    const dialogo = within(screen.getByRole("dialog"));
    expect(dialogo.getByLabelText("Usuário")).toHaveValue("");
    // Sem usuário, salvar só o resto não manda "usuario" (não cria acesso sem querer).
    await user.type(dialogo.getByLabelText("Usuário"), "jose");
    await user.click(dialogo.getByRole("button", { name: "Salvar" }));

    expect(corpoDa("/api/admin/publicadores/j", "PUT")).toMatchObject({ usuario: "jose" });
    const pin = within(await screen.findByRole("dialog", { name: "Acesso de José Lima" }));
    expect(pin.getByText("7351")).toBeInTheDocument();
    await user.click(pin.getByRole("button", { name: "Pronto" }));
    expect((await itemDe("José Lima")).getByText("jose")).toBeInTheDocument();
  });

  it("registro antigo editado sem usuário não envia usuário", async () => {
    mockApiFetch.mockImplementation(async (path, opcoes) => {
      if (path === "/api/admin/publicadores" && !opcoes?.method) return LISTA;
      if (path === "/api/admin/publicadores/j" && opcoes?.method === "PUT") return undefined;
      throw new Error(`chamada inesperada: ${path}`);
    });
    const user = renderizar();

    await user.click((await itemDe("José Lima")).getByRole("button", { name: "Editar José Lima" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Salvar" }));

    expect(corpoDa("/api/admin/publicadores/j", "PUT")).not.toHaveProperty("usuario");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
