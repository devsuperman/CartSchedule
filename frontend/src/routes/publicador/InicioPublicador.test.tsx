import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../../api/client";
import InicioPublicador from "./InicioPublicador";
import type { Solicitacao } from "./components/SolicitacaoCard";

vi.mock("../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/client")>()),
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

// O jsdom não tem canvas; o confete é só enfeite.
const confete = vi.hoisted(() => vi.fn());
vi.mock("canvas-confetti", () => ({ default: confete }));

const whatsapp = vi.hoisted(() => ({ url: "", abrir: vi.fn() }));
vi.mock("../../constants/whatsapp", () => ({
  get GRUPO_WHATSAPP_URL() {
    return whatsapp.url;
  },
  abrirGrupoWhatsapp: whatsapp.abrir,
}));

// Mês-alvo vem da janela, então é sempre um mês "relevante" independente da data real.
const MES_ALVO = "2030-10-01";

function pedido(
  id: number,
  diaSemana: number,
  turnoId: number,
  carrinhoNome: string,
  carrinhoDescricao: string | null = null,
): Solicitacao {
  return {
    id,
    escalaMesReferencia: MES_ALVO,
    carrinhoId: id,
    carrinhoNome,
    carrinhoDescricao,
    diaSemana,
    turnoId,
    origem: 1,
  };
}

// Fora de ordem de propósito (o backend devolve por data de criação).
const SOLICITACOES: Solicitacao[] = [
  pedido(1, 3, 2, "Carrinho 01", "Praça central"),
  pedido(2, 1, 4, "Carrinho 01", "Praça central"),
  pedido(3, 1, 2, "Carrinho 10", "   "),
  pedido(4, 1, 2, "Carrinho 2", "Em frente à estação"),
  pedido(5, 1, 1, "Carrinho 03"),
];

beforeEach(() => {
  whatsapp.url = "";
  whatsapp.abrir.mockReset();
  confete.mockReset();
  mockApiFetch.mockReset();
  mockApiFetch.mockImplementation(async (path) => {
    if (path === "/api/janela") return { aberta: false, mesAlvo: MES_ALVO };
    if (path === "/api/solicitacoes") return SOLICITACOES;
    throw new Error(`chamada inesperada: ${path}`);
  });
});

function renderizar() {
  render(
    <MemoryRouter>
      <InicioPublicador />
    </MemoryRouter>,
  );
}

describe("InicioPublicador — histórico", () => {
  it("lista os pedidos numa única lista ordenada por dia, turno e carrinho, sem títulos por dia", async () => {
    renderizar();

    const lista = await screen.findByRole("list");
    expect(screen.queryByRole("heading", { level: 3 })).not.toBeInTheDocument();
    expect(within(lista).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      expect.stringMatching(/^Segunda-feira.*06:00–08:00.*Carrinho 03/),
      expect.stringMatching(/^Segunda-feira.*08:00–10:00.*Carrinho 2/),
      expect.stringMatching(/^Segunda-feira.*08:00–10:00.*Carrinho 10/),
      expect.stringMatching(/^Segunda-feira.*14:00–16:00.*Carrinho 01/),
      expect.stringMatching(/^Quarta-feira.*08:00–10:00.*Carrinho 01/),
    ]);
  });

  it("mostra no card o dia, o turno, o carrinho e a descrição (só quando há descrição)", async () => {
    renderizar();

    const itens = within(await screen.findByRole("list")).getAllByRole("listitem");

    const comDescricao = within(itens[1]);
    expect(comDescricao.getByText("Segunda-feira")).toBeInTheDocument();
    expect(comDescricao.getByText("08:00–10:00")).toBeInTheDocument();
    expect(comDescricao.getByText("Carrinho 2")).toBeInTheDocument();
    expect(comDescricao.getByText("Em frente à estação")).toBeInTheDocument();

    // Descrição nula ou só com espaços: nada além de dia, turno e carrinho.
    expect(itens[0].textContent).toBe("Segunda-feira06:00–08:00Carrinho 03");
    expect(itens[2].textContent).toBe("Segunda-feira08:00–10:00Carrinho 10");
  });

  it("mostra o turno ao lado do dia, com o mesmo destaque", async () => {
    renderizar();

    const item = within(await screen.findByRole("list")).getAllByRole("listitem")[1];
    const destaque = within(item).getByText("08:00–10:00").parentElement!;
    expect(destaque).toHaveTextContent("Segunda-feira08:00–10:00");
    expect(destaque).toHaveClass("font-bold");
    expect(destaque).not.toHaveTextContent("Carrinho 2");
  });

  it("mostra só o mês no título da lista, sem cabeçalho da tela", async () => {
    renderizar();

    expect(
      await screen.findByRole("heading", { name: "Minhas solicitações para outubro" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Minhas escalas")).not.toBeInTheDocument();
    expect(screen.queryByText(/Pedidos deste mês/)).not.toBeInTheDocument();
  });
});

describe("InicioPublicador — rodapé", () => {
  const GRUPO = "https://chat.whatsapp.com/grupo-de-teste";

  function comJanela(aberta: boolean) {
    mockApiFetch.mockImplementation(async (path) => {
      if (path === "/api/janela") return { aberta, mesAlvo: MES_ALVO };
      if (path === "/api/solicitacoes") return SOLICITACOES;
      throw new Error(`chamada inesperada: ${path}`);
    });
  }

  it("com a janela aberta, o botão de solicitar fica depois da lista", async () => {
    comJanela(true);
    renderizar();

    const lista = await screen.findByRole("list");
    const botao = screen.getByRole("link", { name: "Solicitar Nova Escala" });
    expect(botao).toHaveAttribute("href", "/solicitar");
    expect(lista.compareDocumentPosition(botao) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  const TERMINEI = "Pronto! Terminei minha escala!";

  it("\"Pronto! Terminei minha escala!\" fica acima de \"Solicitar Nova Escala\"", async () => {
    whatsapp.url = GRUPO;
    comJanela(true);
    renderizar();

    const lista = await screen.findByRole("list");
    const terminei = screen.getByRole("button", { name: TERMINEI });
    const solicitar = screen.getByRole("link", { name: "Solicitar Nova Escala" });
    expect(lista.compareDocumentPosition(terminei) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(terminei.compareDocumentPosition(solicitar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText("Terminei!")).not.toBeInTheDocument();
  });

  it("o botão de terminar também aparece com a janela fechada, sem o botão de solicitar", async () => {
    whatsapp.url = GRUPO;
    comJanela(false);
    renderizar();

    expect(await screen.findByRole("button", { name: TERMINEI })).toBeInTheDocument();
    expect(screen.getByText("Envio de pedidos fechado")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Solicitar Nova Escala" })).not.toBeInTheDocument();
  });

  it("sem o link do grupo configurado, não mostra o botão de terminar", async () => {
    comJanela(true);
    renderizar();

    await screen.findByRole("link", { name: "Solicitar Nova Escala" });
    expect(screen.queryByRole("button", { name: TERMINEI })).not.toBeInTheDocument();
  });

  describe("agradecimento", () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    async function abrirAgradecimento() {
      whatsapp.url = GRUPO;
      comJanela(true);
      renderizar();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await user.click(await screen.findByRole("button", { name: TERMINEI }));
      return { user, dialogo: screen.getByRole("dialog") };
    }

    it("abre o modal de agradecimento e redireciona ao grupo após 10 segundos", async () => {
      const { dialogo } = await abrirAgradecimento();

      expect(within(dialogo).getByRole("heading", { name: "Muito Obrigado!" })).toBeInTheDocument();
      expect(
        within(dialogo).getByText("Que Jeová abençoe seu trabalho árduo!"),
      ).toBeInTheDocument();
      expect(within(dialogo).queryByRole("link")).not.toBeInTheDocument();
      expect(confete).toHaveBeenCalled();

      await act(() => vi.advanceTimersByTimeAsync(9000));
      expect(whatsapp.abrir).not.toHaveBeenCalled();
      expect(within(dialogo).getByText(/Voltando ao whatsapp em 1/)).toBeInTheDocument();

      await act(() => vi.advanceTimersByTimeAsync(1000));
      expect(whatsapp.abrir).toHaveBeenCalledTimes(1);
    });

    it("fechar o modal cancela o redirecionamento", async () => {
      const { user } = await abrirAgradecimento();

      await user.click(screen.getByRole("button", { name: "Fechar" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      await act(() => vi.advanceTimersByTimeAsync(20000));
      expect(whatsapp.abrir).not.toHaveBeenCalled();
    });
  });
});
