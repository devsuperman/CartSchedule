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
  { id: "a", nome: "Ana Paula", usuario: "aninha", criancaOuIdoso: false, administrador: true, temPin: true, ehVoce: false },
  { id: "j", nome: "José Lima", usuario: null, criancaOuIdoso: true, administrador: false, temPin: false, ehVoce: false },
];

const JOANA = { id: "o", nome: "Joana Dias", usuario: "joana", criancaOuIdoso: false, administrador: false, temPin: true, ehVoce: false };

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

  it("cria com usuário = primeiro nome e mostra a senha uma vez, com copiar mensagem", async () => {
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
    expect(copiada).toContain("Senha: 2580");
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

  it("dar usuário a um registro antigo cria o acesso e mostra a senha", async () => {
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
  it("redefine a senha com confirmação e mostra a nova senha uma vez", async () => {
    mockApiFetch.mockImplementation(async (path, opcoes) => {
      if (path === "/api/admin/publicadores" && !opcoes?.method) return LISTA;
      if (path === "/api/admin/publicadores/a/pin" && opcoes?.method === "POST") {
        return { id: "a", usuario: "aninha", pin: "8042" };
      }
      throw new Error(`chamada inesperada: ${path}`);
    });
    const user = renderizar();

    await user.click((await itemDe("Ana Paula")).getByRole("button", { name: "Editar Ana Paula" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Redefinir senha" }));

    const confirmacao = within(screen.getByRole("dialog", { name: "Redefinir a senha de Ana Paula?" }));
    expect(confirmacao.getByText(/desconecta.*todos os aparelhos/i)).toBeInTheDocument();
    expect(mockApiFetch).not.toHaveBeenCalledWith("/api/admin/publicadores/a/pin", expect.anything());
    await user.click(confirmacao.getByRole("button", { name: "Redefinir senha" }));

    expect(mockApiFetch).toHaveBeenCalledWith("/api/admin/publicadores/a/pin", { method: "POST" });
    const pin = within(await screen.findByRole("dialog", { name: "Acesso de Ana Paula" }));
    expect(pin.getByText("8042")).toBeInTheDocument();
    await user.click(pin.getByRole("button", { name: "Copiar mensagem" }));
    expect(await navigator.clipboard.readText()).toContain("Senha: 8042");
  });

  it("voltar da confirmação mantém o que já foi digitado, sem chamar a API", async () => {
    const user = renderizar();

    await user.click((await itemDe("Ana Paula")).getByRole("button", { name: "Editar Ana Paula" }));
    const nome = within(screen.getByRole("dialog")).getByLabelText("Nome");
    await user.clear(nome);
    await user.type(nome, "Ana P. Souza");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Redefinir senha" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Voltar" }));

    expect(within(screen.getByRole("dialog")).getByLabelText("Nome")).toHaveValue("Ana P. Souza");
    expect(mockApiFetch).toHaveBeenCalledTimes(1);
  });

  it("na própria conta não oferece excluir nem tirar o administrador", async () => {
    mockApiFetch.mockImplementation(async (path, opcoes) => {
      if (path === "/api/admin/publicadores" && !opcoes?.method) return [{ ...LISTA[0], ehVoce: true }, LISTA[1]];
      throw new Error(`chamada inesperada: ${path}`);
    });
    const user = renderizar();

    await user.click((await itemDe("Ana Paula")).getByRole("button", { name: "Editar Ana Paula" }));

    const dialogo = within(screen.getByRole("dialog"));
    expect(dialogo.queryByRole("button", { name: "Excluir" })).not.toBeInTheDocument();
    expect(dialogo.getByRole("checkbox", { name: /Administrador/ })).toBeDisabled();
    expect(dialogo.getByRole("button", { name: "Redefinir senha" })).toBeInTheDocument();
  });

  it("registro sem usuário não oferece redefinir senha", async () => {
    const user = renderizar();

    await user.click((await itemDe("José Lima")).getByRole("button", { name: "Editar José Lima" }));

    const dialogo = within(screen.getByRole("dialog"));
    expect(dialogo.queryByRole("button", { name: "Redefinir senha" })).not.toBeInTheDocument();
    expect(dialogo.getByRole("button", { name: "Excluir" })).toBeInTheDocument();
  });

  it("lista todos, sem desativar, reativar nem filtro de desativados (ADR 0002)", async () => {
    const user = renderizar();

    expect(await screen.findByText("Ana Paula")).toBeInTheDocument();
    expect(screen.getByText("José Lima")).toBeInTheDocument();
    expect(mockApiFetch).toHaveBeenCalledWith("/api/admin/publicadores");
    expect(screen.queryByRole("checkbox", { name: "Mostrar desativados" })).not.toBeInTheDocument();
    expect(screen.queryByText("Desativado")).not.toBeInTheDocument();

    await user.click((await itemDe("Ana Paula")).getByRole("button", { name: "Editar Ana Paula" }));
    const dialogo = within(screen.getByRole("dialog"));
    expect(dialogo.queryByRole("button", { name: "Desativar" })).not.toBeInTheDocument();
    expect(dialogo.queryByRole("button", { name: "Reativar" })).not.toBeInTheDocument();
  });
  it("erro ao redefinir a senha aparece na confirmação", async () => {
    mockApiFetch.mockImplementation(async (path, opcoes) => {
      if (path === "/api/admin/publicadores" && !opcoes?.method) return LISTA;
      throw new ApiError(404, "Não encontrado.");
    });
    const user = renderizar();

    await user.click((await itemDe("Ana Paula")).getByRole("button", { name: "Editar Ana Paula" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Redefinir senha" }));
    const confirmacao = within(screen.getByRole("dialog"));
    await user.click(confirmacao.getByRole("button", { name: "Redefinir senha" }));

    expect(await confirmacao.findByText("Não encontrado.")).toBeInTheDocument();
  });

  it("une vários registros ao que fica: marca as origens, vê a prévia somada e confirma", async () => {
    const lista = [...LISTA, JOANA];
    mockApiFetch.mockImplementation(async (path, opcoes) => {
      if (path === "/api/admin/publicadores" && !opcoes?.method) return lista;
      if (path === "/api/admin/publicadores/a/unir/previa" && opcoes?.method === "POST") {
        const { origemIds } = JSON.parse(opcoes.body as string);
        return origemIds.length === 1 ? { pedidosMovidos: 2, pedidosDescartados: 0 } : { pedidosMovidos: 3, pedidosDescartados: 1 };
      }
      if (path === "/api/admin/publicadores/a/unir" && opcoes?.method === "POST") {
        return { pedidosMovidos: 3, pedidosDescartados: 1 };
      }
      throw new Error(`chamada inesperada: ${path}`);
    });
    const user = renderizar();

    await user.click((await itemDe("Ana Paula")).getByRole("button", { name: "Editar Ana Paula" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Unir outros registros a este" }));

    const unir = within(screen.getByRole("dialog", { name: "Unir outros registros a Ana Paula" }));
    expect(unir.queryByRole("checkbox", { name: /Ana Paula/ })).not.toBeInTheDocument();
    expect(unir.getByRole("button", { name: "Unir" })).toBeDisabled();

    await user.click(unir.getByRole("checkbox", { name: /José Lima/ }));
    expect(await unir.findByText("2 pedidos passam para Ana Paula.")).toBeInTheDocument();
    expect(corpoDa("/api/admin/publicadores/a/unir/previa", "POST")).toEqual({ origemIds: ["j"] });

    await user.click(unir.getByRole("checkbox", { name: /Joana Dias/ }));
    expect(await unir.findByText("3 pedidos passam para Ana Paula.")).toBeInTheDocument();
    expect(corpoDa("/api/admin/publicadores/a/unir/previa", "POST")).toEqual({ origemIds: ["j", "o"] });
    expect(unir.getByText(/1 pedido será descartado/)).toBeInTheDocument();
    expect(unir.getByText(/José Lima e Joana Dias serão apagados/)).toBeInTheDocument();
    expect(unir.getByText(/o usuário joana deixa de entrar/)).toBeInTheDocument();
    expect(mockApiFetch).not.toHaveBeenCalledWith("/api/admin/publicadores/a/unir", expect.anything());

    await user.click(unir.getByRole("button", { name: "Unir" }));

    expect(corpoDa("/api/admin/publicadores/a/unir", "POST")).toEqual({ origemIds: ["j", "o"] });
    expect(await screen.findByRole("status")).toHaveTextContent("José Lima e Joana Dias foram unidos a Ana Paula.");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("José Lima")).not.toBeInTheDocument();
    expect(screen.queryByText("Joana Dias")).not.toBeInTheDocument();
    // A marca criança/idoso de uma origem passa para o destino.
    expect((await itemDe("Ana Paula")).getByText("Criança ou idoso")).toBeInTheDocument();
  });

  it("com uma origem só, a mensagem fica no singular", async () => {
    mockApiFetch.mockImplementation(async (path, opcoes) => {
      if (path === "/api/admin/publicadores" && !opcoes?.method) return LISTA;
      if (path.startsWith("/api/admin/publicadores/a/unir") && opcoes?.method === "POST") {
        return { pedidosMovidos: 0, pedidosDescartados: 0 };
      }
      throw new Error(`chamada inesperada: ${path}`);
    });
    const user = renderizar();

    await user.click((await itemDe("Ana Paula")).getByRole("button", { name: "Editar Ana Paula" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Unir outros registros a este" }));
    const unir = within(screen.getByRole("dialog"));
    await user.click(unir.getByRole("checkbox", { name: /José Lima/ }));
    expect(await unir.findByText("Nenhum pedido para passar a Ana Paula.")).toBeInTheDocument();
    expect(unir.getByText(/José Lima será apagado/)).toBeInTheDocument();
    await user.click(unir.getByRole("button", { name: "Unir" }));

    expect(await screen.findByRole("status")).toHaveTextContent("José Lima foi unido a Ana Paula.");
  });

  it("a busca não esconde quem já foi marcado", async () => {
    mockApiFetch.mockImplementation(async (path, opcoes) => {
      if (path === "/api/admin/publicadores" && !opcoes?.method) return [...LISTA, JOANA];
      if (path === "/api/admin/publicadores/a/unir/previa") return { pedidosMovidos: 0, pedidosDescartados: 0 };
      throw new Error(`chamada inesperada: ${path}`);
    });
    const user = renderizar();

    await user.click((await itemDe("Ana Paula")).getByRole("button", { name: "Editar Ana Paula" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Unir outros registros a este" }));
    const unir = within(screen.getByRole("dialog"));
    await user.click(unir.getByRole("checkbox", { name: /José Lima/ }));
    await user.type(unir.getByRole("searchbox", { name: "Buscar registros para unir" }), "joana");

    expect(unir.getByRole("checkbox", { name: /José Lima/ })).toBeChecked();
    expect(unir.getByRole("checkbox", { name: /Joana Dias/ })).not.toBeChecked();
  });

  it("só vale a prévia da seleção atual, mesmo que uma anterior chegue depois", async () => {
    let responderPrimeira: (valor: unknown) => void = () => {};
    mockApiFetch.mockImplementation(async (path, opcoes) => {
      if (path === "/api/admin/publicadores" && !opcoes?.method) return [...LISTA, JOANA];
      if (path === "/api/admin/publicadores/a/unir/previa") {
        const { origemIds } = JSON.parse(opcoes!.body as string);
        if (origemIds.length === 1) return new Promise((resolver) => (responderPrimeira = resolver));
        return { pedidosMovidos: 5, pedidosDescartados: 0 };
      }
      throw new Error(`chamada inesperada: ${path}`);
    });
    const user = renderizar();

    await user.click((await itemDe("Ana Paula")).getByRole("button", { name: "Editar Ana Paula" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Unir outros registros a este" }));
    const unir = within(screen.getByRole("dialog"));
    await user.click(unir.getByRole("checkbox", { name: /José Lima/ }));
    await user.click(unir.getByRole("checkbox", { name: /Joana Dias/ }));
    expect(await unir.findByText("5 pedidos passam para Ana Paula.")).toBeInTheDocument();

    responderPrimeira({ pedidosMovidos: 1, pedidosDescartados: 0 });

    await new Promise((r) => setTimeout(r, 0));
    expect(unir.getByText("5 pedidos passam para Ana Paula.")).toBeInTheDocument();
    expect(unir.queryByText("1 pedido passa para Ana Paula.")).not.toBeInTheDocument();
  });

  it("na própria conta oferece unir outros a ela, e a conta logada nunca aparece como origem", async () => {
    mockApiFetch.mockImplementation(async (path, opcoes) => {
      if (path === "/api/admin/publicadores" && !opcoes?.method) return [{ ...LISTA[0], ehVoce: true }, LISTA[1], JOANA];
      throw new Error(`chamada inesperada: ${path}`);
    });
    const user = renderizar();

    await user.click((await itemDe("Ana Paula")).getByRole("button", { name: "Editar Ana Paula" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Unir outros registros a este" }));
    expect(within(screen.getByRole("dialog")).getByRole("checkbox", { name: /José Lima/ })).toBeInTheDocument();
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Voltar" }));
    await user.keyboard("{Escape}");

    await user.click((await itemDe("José Lima")).getByRole("button", { name: "Editar José Lima" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Unir outros registros a este" }));
    const unir = within(screen.getByRole("dialog"));
    expect(unir.getByRole("checkbox", { name: /Joana Dias/ })).toBeInTheDocument();
    expect(unir.queryByRole("checkbox", { name: /Ana Paula/ })).not.toBeInTheDocument();
  });

  it("erro ao unir aparece na confirmação e nada some da lista", async () => {
    mockApiFetch.mockImplementation(async (path, opcoes) => {
      if (path === "/api/admin/publicadores" && !opcoes?.method) return LISTA;
      if (path === "/api/admin/publicadores/a/unir/previa") return { pedidosMovidos: 0, pedidosDescartados: 0 };
      throw new ApiError(404, "Não encontrado.");
    });
    const user = renderizar();

    await user.click((await itemDe("Ana Paula")).getByRole("button", { name: "Editar Ana Paula" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Unir outros registros a este" }));
    const unir = within(screen.getByRole("dialog"));
    await user.click(unir.getByRole("checkbox", { name: /José Lima/ }));
    expect(await unir.findByText("Nenhum pedido para passar a Ana Paula.")).toBeInTheDocument();
    await user.click(unir.getByRole("button", { name: "Unir" }));

    expect(await unir.findByText("Não encontrado.")).toBeInTheDocument();
    await user.click(unir.getByRole("button", { name: "Voltar" }));
    await user.keyboard("{Escape}");
    expect(screen.getByText("José Lima")).toBeInTheDocument();
  });

  it("exclui com prévia dos pedidos e a pessoa some da lista", async () => {
    mockApiFetch.mockImplementation(async (path, opcoes) => {
      if (path === "/api/admin/publicadores" && !opcoes?.method) return LISTA;
      if (path === "/api/admin/publicadores/j/exclusao" && !opcoes?.method) return { pedidos: 3, escalas: 2 };
      if (path === "/api/admin/publicadores/j" && opcoes?.method === "DELETE") return undefined;
      throw new Error(`chamada inesperada: ${path}`);
    });
    const user = renderizar();

    await user.click((await itemDe("José Lima")).getByRole("button", { name: "Editar José Lima" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Excluir" }));

    const excluir = within(screen.getByRole("dialog", { name: "Excluir José Lima?" }));
    expect(await excluir.findByText(/3 pedidos em 2 escalas/)).toBeInTheDocument();
    expect(excluir.getByText(/Não dá para desfazer/)).toBeInTheDocument();
    expect(mockApiFetch).not.toHaveBeenCalledWith("/api/admin/publicadores/j", { method: "DELETE" });
    await user.click(excluir.getByRole("button", { name: "Excluir" }));

    expect(mockApiFetch).toHaveBeenCalledWith("/api/admin/publicadores/j", { method: "DELETE" });
    expect(await screen.findByRole("status")).toHaveTextContent("José Lima foi excluído.");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("José Lima")).not.toBeInTheDocument();
  });

  it("voltar da exclusão não exclui", async () => {
    mockApiFetch.mockImplementation(async (path, opcoes) => {
      if (path === "/api/admin/publicadores" && !opcoes?.method) return LISTA;
      if (path === "/api/admin/publicadores/j/exclusao" && !opcoes?.method) return { pedidos: 1, escalas: 1 };
      throw new Error(`chamada inesperada: ${path}`);
    });
    const user = renderizar();

    await user.click((await itemDe("José Lima")).getByRole("button", { name: "Editar José Lima" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Excluir" }));
    const excluir = within(screen.getByRole("dialog"));
    expect(await excluir.findByText(/1 pedido em 1 escala/)).toBeInTheDocument();
    await user.click(excluir.getByRole("button", { name: "Voltar" }));

    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Excluir" })).toBeInTheDocument();
    expect(mockApiFetch).not.toHaveBeenCalledWith("/api/admin/publicadores/j", { method: "DELETE" });
  });

  it("na própria conta não oferece excluir", async () => {
    mockApiFetch.mockImplementation(async (path, opcoes) => {
      if (path === "/api/admin/publicadores" && !opcoes?.method) return [{ ...LISTA[0], ehVoce: true }, LISTA[1]];
      throw new Error(`chamada inesperada: ${path}`);
    });
    const user = renderizar();

    await user.click((await itemDe("Ana Paula")).getByRole("button", { name: "Editar Ana Paula" }));

    expect(within(screen.getByRole("dialog")).queryByRole("button", { name: "Excluir" })).not.toBeInTheDocument();
  });

  it("erro ao excluir aparece na confirmação e nada some da lista", async () => {
    mockApiFetch.mockImplementation(async (path, opcoes) => {
      if (path === "/api/admin/publicadores" && !opcoes?.method) return LISTA;
      if (path === "/api/admin/publicadores/j/exclusao" && !opcoes?.method) return { pedidos: 0, escalas: 0 };
      throw new ApiError(404, "Não encontrado.");
    });
    const user = renderizar();

    await user.click((await itemDe("José Lima")).getByRole("button", { name: "Editar José Lima" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Excluir" }));
    const excluir = within(screen.getByRole("dialog"));
    expect(await excluir.findByText(/José Lima não tem pedidos/)).toBeInTheDocument();
    await user.click(excluir.getByRole("button", { name: "Excluir" }));

    expect(await excluir.findByText("Não encontrado.")).toBeInTheDocument();
    await user.click(excluir.getByRole("button", { name: "Voltar" }));
    await user.keyboard("{Escape}");
    expect(screen.getByText("José Lima")).toBeInTheDocument();
  });
});
