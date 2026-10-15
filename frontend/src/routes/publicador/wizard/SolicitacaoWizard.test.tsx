import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, ApiError } from "../../../api/client";
import { PUBLICADOR_NOME_STORAGE_KEY } from "../../../api/client";
import { SolicitacaoWizard, type Carrinho } from "./SolicitacaoWizard";

vi.mock("../../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../api/client")>()),
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

// Carrinho 01: 08–10 na Segunda (vaga) e 10–12 na Terça (1 pessoa). Carrinho 02: 08–10 e
// 14–16 na Segunda, ambos cheios. Carrinho 03: nenhum turno configurado (não deve aparecer).
// Carrinho 04: só 16–18 na Quarta, cheio (a Quarta aparece, mas desabilitada).
const CARRINHOS: Carrinho[] = [
  {
    id: 1,
    nome: "Carrinho 01",
    descricao: "Em frente à estação",
    disponibilidades: [
      { diaSemana: 1, turnoId: 2, ocupacao: 0, cheia: false },
      { diaSemana: 2, turnoId: 3, ocupacao: 1, cheia: false },
    ],
  },
  {
    id: 2,
    nome: "Carrinho 02",
    descricao: null,
    disponibilidades: [
      { diaSemana: 1, turnoId: 2, ocupacao: 2, cheia: true },
      { diaSemana: 1, turnoId: 4, ocupacao: 2, cheia: true },
    ],
  },
  { id: 3, nome: "Carrinho 03", descricao: null, disponibilidades: [] },
  {
    id: 4,
    nome: "Carrinho 04",
    descricao: null,
    disponibilidades: [{ diaSemana: 3, turnoId: 5, ocupacao: 2, cheia: true }],
  },
];

type Rotas = {
  carrinhos?: () => Carrinho[] | Promise<Carrinho[]>;
  historico?: () => unknown;
  enviar?: () => unknown;
};

function mockarApi({ carrinhos = () => CARRINHOS, historico = () => [], enviar = () => ({ id: 10 }) }: Rotas = {}) {
  mockApiFetch.mockImplementation(async (path, opcoes) => {
    if (path === "/api/carrinhos") return carrinhos();
    if (path === "/api/solicitacoes") return opcoes?.method === "POST" ? enviar() : historico();
    throw new Error(`chamada inesperada: ${path}`);
  });
}

function renderWizard() {
  render(
    <MemoryRouter>
      <SolicitacaoWizard mesAlvo="2026-10-01" />
    </MemoryRouter>,
  );
  return userEvent.setup();
}

type Usuario = ReturnType<typeof userEvent.setup>;

async function continuar(user: Usuario) {
  await user.click(screen.getByRole("button", { name: "Continuar" }));
}

async function voltar(user: Usuario) {
  await user.click(screen.getByRole("button", { name: "Voltar" }));
}

/** Espera a primeira etapa (dia) com os carrinhos carregados. */
async function esperarEtapaDoDia() {
  await screen.findByText("Em qual dia da semana?");
  await screen.findByRole("radio", { name: /Segunda-feira/ });
}

async function escolherDia(user: Usuario, dia: RegExp) {
  await user.click(screen.getByRole("radio", { name: dia }));
  await continuar(user);
  await screen.findByText("Em qual turno?");
}

async function escolherTurno(user: Usuario, turno: RegExp) {
  await user.click(screen.getByRole("radio", { name: turno }));
  await continuar(user);
  await screen.findByText("Em qual carrinho?");
}

function radiosVisiveis() {
  return screen.getAllByRole("radio").map((r) => r.textContent);
}

beforeEach(() => {
  localStorage.setItem(PUBLICADOR_NOME_STORAGE_KEY, "Bia");
  mockApiFetch.mockReset();
  mockarApi();
});

describe("SolicitacaoWizard — dia, depois turno, depois carrinho", () => {
  it("abre no dia da semana, em 3 passos, sem pedir o nome", async () => {
    renderWizard();
    await esperarEtapaDoDia();

    expect(screen.getByText("Passo 1 de 3")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Seu nome" })).not.toBeInTheDocument();
  });

  it("mostra só os dias com turno em algum carrinho e desabilita o dia sem vaga livre", async () => {
    renderWizard();
    await esperarEtapaDoDia();

    expect(radiosVisiveis()).toEqual(["Segunda-feira", "Terça-feira", "Quarta-feira"]);
    expect(screen.getByRole("radio", { name: /Quarta-feira/ })).toBeDisabled();
    expect(screen.getByRole("radio", { name: /Quarta-feira/ })).not.toHaveTextContent("Cheio");
    expect(screen.getByRole("radio", { name: /Segunda-feira/ })).toBeEnabled();
  });

  it("mostra só os turnos do dia em algum carrinho e desabilita o turno sem vaga livre", async () => {
    const user = renderWizard();
    await esperarEtapaDoDia();
    await escolherDia(user, /Segunda-feira/);

    expect(radiosVisiveis()).toEqual(["08:00–10:00", "14:00–16:00"]);
    expect(screen.getByRole("radio", { name: /08:00–10:00/ })).toBeEnabled();
    expect(screen.getByRole("radio", { name: /14:00–16:00/ })).toBeDisabled();
  });

  it("mostra só os carrinhos com aquele dia e turno, com a ocupação, e desabilita o cheio", async () => {
    const user = renderWizard();
    await esperarEtapaDoDia();
    await escolherDia(user, /Segunda-feira/);
    await escolherTurno(user, /08:00–10:00/);

    expect(screen.getAllByRole("radio")).toHaveLength(2);
    const vago = screen.getByRole("radio", { name: /Carrinho 01/ });
    expect(vago).toHaveTextContent("Em frente à estação");
    expect(vago).toHaveTextContent("Vago");
    const cheio = screen.getByRole("radio", { name: /Carrinho 02/ });
    expect(cheio).toHaveTextContent("Cheio");
    expect(cheio).toBeDisabled();
  });

  it("mostra '1 pessoa nesta vaga'", async () => {
    const user = renderWizard();
    await esperarEtapaDoDia();
    await escolherDia(user, /Terça-feira/);
    await escolherTurno(user, /10:00–12:00/);

    expect(screen.getByRole("radio", { name: /Carrinho 01/ })).toHaveTextContent("1 pessoa nesta vaga");
  });

  it("envia nome, carrinho, dia e turno escolhidos", async () => {
    const user = renderWizard();
    await esperarEtapaDoDia();
    await escolherDia(user, /Terça-feira/);
    await escolherTurno(user, /10:00–12:00/);
    await user.click(screen.getByRole("radio", { name: /Carrinho 01/ }));
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith("/api/solicitacoes", expect.objectContaining({ method: "POST" })),
    );
    const [, opcoes] = mockApiFetch.mock.calls.find(
      ([path, o]) => path === "/api/solicitacoes" && o?.method === "POST",
    )!;
    expect(JSON.parse(opcoes!.body as string)).toEqual({ nome: "Bia", carrinhoId: 1, diaSemana: 2, turnoId: 3 });
  });

  it("quando o servidor limita o envio (429), mostra o aviso para aguardar", async () => {
    mockarApi({
      enviar: () => {
        throw new ApiError(429, "Muitas tentativas. Aguarde um pouco e tente novamente.", {
          codigo: "MUITAS_REQUISICOES",
        });
      },
    });
    const user = renderWizard();
    await esperarEtapaDoDia();
    await escolherDia(user, /Terça-feira/);
    await escolherTurno(user, /10:00–12:00/);
    await user.click(screen.getByRole("radio", { name: /Carrinho 01/ }));
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Muitas tentativas. Aguarde um pouco e tente novamente.")).toBeInTheDocument();
  });
});

describe("SolicitacaoWizard — horário em que o publicador já tem pedido", () => {
  const PEDIDO = {
    id: 7,
    carrinhoId: 1,
    carrinhoNome: "Carrinho 01",
    carrinhoDescricao: null,
    diaSemana: 1,
    turnoId: 2,
    origem: 0,
    escalaMesReferencia: "2026-10-01",
  };

  // Na Segunda, 08–10 no Carrinho 01 (o pedido dele) e no Carrinho 05 (vago), e 18–20 no 05.
  const CARRINHOS_SEGUNDA: Carrinho[] = [
    CARRINHOS[0],
    {
      id: 5,
      nome: "Carrinho 05",
      descricao: null,
      disponibilidades: [
        { diaSemana: 1, turnoId: 2, ocupacao: 0, cheia: false },
        { diaSemana: 1, turnoId: 6, ocupacao: 0, cheia: false },
      ],
    },
  ];

  it("desabilita o horário e avisa, mesmo com vaga em outro carrinho", async () => {
    mockarApi({ carrinhos: () => CARRINHOS_SEGUNDA, historico: () => [PEDIDO] });
    const user = renderWizard();
    await esperarEtapaDoDia();
    await escolherDia(user, /Segunda-feira/);

    const meu = screen.getByRole("radio", { name: /08:00–10:00/ });
    await waitFor(() => expect(meu).toBeDisabled());
    expect(meu).toHaveTextContent("Você já tem pedido neste horário");
    const outro = screen.getByRole("radio", { name: /18:00–20:00/ });
    expect(outro).toBeEnabled();
    expect(outro).not.toHaveTextContent("Você já tem pedido");
  });

  it("desabilita o dia em que todos os horários já são dele ou estão cheios", async () => {
    mockarApi({ historico: () => [PEDIDO] });
    renderWizard();
    await esperarEtapaDoDia();

    // Na Segunda, 08–10 já é dele e 14–16 está cheio.
    await waitFor(() => expect(screen.getByRole("radio", { name: /Segunda-feira/ })).toBeDisabled());
    expect(screen.getByRole("radio", { name: /Terça-feira/ })).toBeEnabled();
  });

  it("ignora pedidos de outras escalas", async () => {
    mockarApi({ historico: () => [{ ...PEDIDO, escalaMesReferencia: "2026-09-01" }] });
    const user = renderWizard();
    await esperarEtapaDoDia();
    await escolherDia(user, /Segunda-feira/);

    const turno = screen.getByRole("radio", { name: /08:00–10:00/ });
    expect(turno).toBeEnabled();
    expect(turno).not.toHaveTextContent("Você já tem pedido");
  });

  it("se o histórico não carrega, o wizard funciona mesmo assim", async () => {
    mockarApi({
      historico: () => {
        throw new ApiError(500, "Erro no servidor");
      },
    });
    const user = renderWizard();
    await esperarEtapaDoDia();
    await escolherDia(user, /Segunda-feira/);
    await escolherTurno(user, /08:00–10:00/);

    expect(screen.getByRole("radio", { name: /Carrinho 01/ })).toBeEnabled();
  });

  it("se o servidor diz que o horário está ocupado, volta ao turno, avisa e o desabilita", async () => {
    mockarApi({
      carrinhos: () => CARRINHOS_SEGUNDA,
      enviar: () => {
        throw new ApiError(409, "Horário ocupado", { codigo: "HORARIO_OCUPADO" });
      },
    });
    const user = renderWizard();
    await esperarEtapaDoDia();
    await escolherDia(user, /Segunda-feira/);
    await escolherTurno(user, /08:00–10:00/);
    await user.click(screen.getByRole("radio", { name: /Carrinho 05/ }));
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Você já tem pedido nesse dia e horário. Escolha outro horário.")).toBeInTheDocument();
    expect(screen.getByText("Em qual turno?")).toBeInTheDocument();
    const turno = screen.getByRole("radio", { name: /08:00–10:00/ });
    expect(turno).toBeDisabled();
    expect(turno).toHaveTextContent("Você já tem pedido neste horário");
    expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled();
  });
});

describe("SolicitacaoWizard — voltar e trocar a escolha", () => {
  it("ao trocar para um dia em que o turno escolhido não existe, limpa o turno", async () => {
    const user = renderWizard();
    await esperarEtapaDoDia();
    await escolherDia(user, /Segunda-feira/);
    await escolherTurno(user, /08:00–10:00/);

    await voltar(user);
    await voltar(user);
    await escolherDia(user, /Terça-feira/);

    expect(radiosVisiveis()).toEqual(["10:00–12:00"]);
    expect(screen.getByRole("radio", { name: /10:00–12:00/ })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled();
  });

  it("ao trocar para um turno em que o carrinho escolhido não está, limpa o carrinho", async () => {
    mockarApi({
      carrinhos: () => [
        CARRINHOS[0],
        {
          id: 2,
          nome: "Carrinho 02",
          descricao: null,
          disponibilidades: [
            { diaSemana: 1, turnoId: 2, ocupacao: 0, cheia: false },
            { diaSemana: 1, turnoId: 6, ocupacao: 0, cheia: false },
          ],
        },
      ],
    });
    const user = renderWizard();
    await esperarEtapaDoDia();
    await escolherDia(user, /Segunda-feira/);
    await escolherTurno(user, /08:00–10:00/);
    await user.click(screen.getByRole("radio", { name: /Carrinho 01/ }));

    await voltar(user);
    await escolherTurno(user, /18:00–20:00/);

    expect(radiosVisiveis()).toEqual([expect.stringContaining("Carrinho 02")]);
    expect(screen.getByRole("radio", { name: /Carrinho 02/ })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();
  });
});

describe("SolicitacaoWizard — vaga que encheu no envio", () => {
  const CARRINHO_01_TERCA_CHEIA: Carrinho[] = [
    {
      ...CARRINHOS[0],
      disponibilidades: [
        { diaSemana: 1, turnoId: 2, ocupacao: 0, cheia: false },
        { diaSemana: 2, turnoId: 3, ocupacao: 2, cheia: true },
      ],
    },
  ];

  async function enviarTercaCarrinho01(user: Usuario) {
    await esperarEtapaDoDia();
    await escolherDia(user, /Terça-feira/);
    await escolherTurno(user, /10:00–12:00/);
    await user.click(await screen.findByRole("radio", { name: /Carrinho 01/ }));
    await user.click(screen.getByRole("button", { name: "Salvar" }));
  }

  it("se a vaga encheu durante o envio (VAGA_CHEIA), fica no carrinho, avisa e recarrega", async () => {
    let chamadas = 0;
    mockarApi({
      carrinhos: () => (++chamadas < 3 ? CARRINHOS : CARRINHO_01_TERCA_CHEIA),
      enviar: () => {
        throw new ApiError(409, "Vaga cheia", { codigo: "VAGA_CHEIA" });
      },
    });
    const user = renderWizard();
    await enviarTercaCarrinho01(user);

    expect(await screen.findByText(/acabou de ficar cheia/)).toBeInTheDocument();
    expect(screen.getByText("Em qual carrinho?")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("radio", { name: /Carrinho 01/ })).toBeDisabled());
    expect(screen.getByRole("radio", { name: /Carrinho 01/ })).toHaveTextContent("Cheio");
  });

  it("se a recarga falha depois de VAGA_CHEIA, desabilita a vaga mesmo assim e avisa", async () => {
    let chamadas = 0;
    mockarApi({
      carrinhos: () => {
        if (++chamadas < 3) return CARRINHOS;
        throw new ApiError(500, "Erro no servidor");
      },
      enviar: () => {
        throw new ApiError(409, "Vaga cheia", { codigo: "VAGA_CHEIA" });
      },
    });
    const user = renderWizard();
    await enviarTercaCarrinho01(user);

    expect(await screen.findByText(/não foi possível atualizar as outras vagas/)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Carrinho 01/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();
  });
});

describe("SolicitacaoWizard — mês-alvo e saída", () => {
  it("mostra o mês-alvo no topo em todas as etapas", async () => {
    const user = renderWizard();
    expect(screen.getByText("outubro de 2026")).toBeInTheDocument();

    await esperarEtapaDoDia();
    expect(screen.getByText("outubro de 2026")).toBeInTheDocument();

    await escolherDia(user, /Terça-feira/);
    expect(screen.getByText("outubro de 2026")).toBeInTheDocument();

    await escolherTurno(user, /10:00–12:00/);
    expect(screen.getByText("outubro de 2026")).toBeInTheDocument();
  });

  it("Voltar na primeira etapa sai para a tela inicial", async () => {
    render(
      <MemoryRouter initialEntries={["/solicitar"]}>
        <Routes>
          <Route path="/" element={<p>Tela inicial</p>} />
          <Route path="/solicitar" element={<SolicitacaoWizard mesAlvo="2026-10-01" />} />
        </Routes>
      </MemoryRouter>,
    );
    const user = userEvent.setup();
    await esperarEtapaDoDia();

    await voltar(user);

    expect(screen.getByText("Tela inicial")).toBeInTheDocument();
  });
});
