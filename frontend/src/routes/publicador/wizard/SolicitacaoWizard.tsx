import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, ApiError } from "../../../api/client";
import { usePublicadorToken } from "../../../hooks/usePublicadorToken";
import { ehErroDeJanelaFechada } from "../../../hooks/useJanela";
import { TURNOS } from "../../../constants/turnos";
import { DIAS_SEMANA, type DiaSemana } from "../../../constants/diasSemana";
import { formatarMes } from "../../../utils/formatacao";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import JanelaFechada from "../JanelaFechada";
import type { Solicitacao } from "../components/SolicitacaoCard";
import { WizardProgresso } from "./WizardProgresso";
import { EtapaDiaSemana, type OpcaoDia } from "./EtapaDiaSemana";
import { EtapaTurno, type OpcaoTurno } from "./EtapaTurno";
import { EtapaCarrinho, type VagaCarrinho } from "./EtapaCarrinho";

/** Contrato de GET /api/carrinhos (TECHNICAL_SPEC.md, tarefas F1-BE-02/F5-BE-01/F6-BE-03):
 * `disponibilidades` são os pares (dia da semana, turno) habilitados no carrinho, com a
 * `ocupacao` atual da vaga na escala-alvo e `cheia` (publicador não pode mais pedi-la). */
export interface Carrinho {
  id: number;
  nome: string;
  descricao: string | null;
  disponibilidades: { diaSemana: DiaSemana; turnoId: number; ocupacao: number; cheia: boolean }[];
}

/** Chave de uma vaga (carrinho, dia, turno), para o conjunto de vagas que o publicador já pediu. */
function chaveVaga(carrinhoId: number, dia: number, turnoId: number): string {
  return `${carrinhoId}-${dia}-${turnoId}`;
}

/** O publicador pode pedir a vaga: configurada no carrinho, não cheia e ainda não pedida por ele. */
function podePedir(
  carrinho: Carrinho | undefined,
  jaPedidas: ReadonlySet<string>,
  dia: DiaSemana,
  turnoId: number,
): boolean {
  return (
    carrinho != null &&
    !jaPedidas.has(chaveVaga(carrinho.id, dia, turnoId)) &&
    carrinho.disponibilidades.some((d) => d.diaSemana === dia && d.turnoId === turnoId && !d.cheia)
  );
}

/** Algum carrinho tem vaga que o publicador pode pedir nesse (dia, turno). */
function turnoLivre(
  carrinhos: readonly Carrinho[],
  jaPedidas: ReadonlySet<string>,
  dia: DiaSemana,
  turnoId: number,
): boolean {
  return carrinhos.some((c) => podePedir(c, jaPedidas, dia, turnoId));
}

/** Algum carrinho tem esse (dia, turno) configurado (turno = null: qualquer turno no dia). */
function configurado(carrinhos: readonly Carrinho[], dia: DiaSemana, turnoId: number | null): boolean {
  return carrinhos.some((c) =>
    c.disponibilidades.some((d) => d.diaSemana === dia && (turnoId == null || d.turnoId === turnoId)),
  );
}

/** Código do ProblemDetails (409) quando a vaga encheu antes do envio. */
const CODIGO_VAGA_CHEIA = "VAGA_CHEIA";

function ehErroDeVagaCheia(err: unknown): boolean {
  return (
    err instanceof ApiError &&
    (err.details as { codigo?: string } | null | undefined)?.codigo === CODIGO_VAGA_CHEIA
  );
}

/** Contrato de POST /api/solicitacoes (TECHNICAL_SPEC.md, tarefa F1-BE-03). */
interface SolicitacaoCriadaResponse {
  id: number;
  carrinhoId: number;
  diaSemana: DiaSemana;
  turnoId: number;
}

type Etapa = 1 | 2 | 3;
const TOTAL_ETAPAS = 3;

const TITULOS: Record<Etapa, string> = {
  1: "Em qual dia da semana?",
  2: "Em qual turno?",
  3: "Em qual carrinho?",
};

interface SolicitacaoWizardProps {
  /** Primeiro dia do mês-alvo (ISO), vindo de useJanela() no componente pai (SolicitarEscala) —
   * evita buscar a janela de novo aqui. */
  mesAlvo: string;
}

/**
 * Formulário de solicitação em 3 etapas (PLANNING.md §5): dia da semana → turno → carrinho,
 * uma pergunta por tela, com um botão grande de confirmação no rodapé. O nome não é pedido
 * aqui: ele é informado no primeiro acesso (rota /nome) e vai junto no envio. "Voltar" na
 * primeira etapa sai do wizard para a tela inicial. Cada
 * Etapa* é "burra" (recebe valor + callback, sem estado próprio); este componente guarda
 * todo o estado e faz o submit final.
 */
export function SolicitacaoWizard({ mesAlvo }: SolicitacaoWizardProps) {
  const navigate = useNavigate();
  const { nome } = usePublicadorToken();
  const [etapa, setEtapa] = useState<Etapa>(1);
  const [diaSemana, setDiaSemana] = useState<DiaSemana | null>(null);
  const [turnoId, setTurnoId] = useState<number | null>(null);
  const [carrinhoId, setCarrinhoId] = useState<number | null>(null);

  const [carrinhos, setCarrinhos] = useState<Carrinho[]>([]);
  const [carregandoCarrinhos, setCarregandoCarrinhos] = useState(true);
  const [erroCarrinhos, setErroCarrinhos] = useState<string | null>(null);
  /** Vagas que o publicador já pediu na escala-alvo — pedir de novo seria duplicidade (PLANNING.md §5). */
  const [jaPedidas, setJaPedidas] = useState<ReadonlySet<string>>(new Set());

  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  // Corner case: a janela fecha entre o usuário abrir o wizard e enviar (ex: o
  // administrador encerrou o envio enquanto ele preenchia). O backend recusa com codigo
  // JANELA_FECHADA (outros 400 viram mensagem de erro normal); em vez de
  // inventar uma segunda mensagem de erro, reaproveitamos a tela já existente.
  const [janelaFechouAgora, setJanelaFechouAgora] = useState(false);

  useEffect(() => {
    let cancelado = false;

    apiFetch<Carrinho[]>("/api/carrinhos")
      .then((resposta) => {
        if (!cancelado) setCarrinhos(resposta);
      })
      .catch((err: unknown) => {
        if (!cancelado) {
          setErroCarrinhos(
            err instanceof ApiError ? err.message : "Não foi possível carregar os carrinhos disponíveis.",
          );
        }
      })
      .finally(() => {
        if (!cancelado) setCarregandoCarrinhos(false);
      });

    // Falha silenciosa: sem o histórico nenhuma vaga fica marcada como já pedida, e o backend
    // continua recusando a duplicidade no envio (409).
    apiFetch<Solicitacao[]>("/api/solicitacoes")
      .then((resposta) => {
        if (cancelado) return;
        setJaPedidas(
          new Set(
            resposta
              .filter((s) => s.escalaMesReferencia === mesAlvo)
              .map((s) => chaveVaga(s.carrinhoId, s.diaSemana, s.turnoId)),
          ),
        );
      })
      .catch(() => {});

    return () => {
      cancelado = true;
    };
  }, [mesAlvo]);

  // Os turnos dependem de (carrinho, dia) (PLANNING.md regra 17): só aparecem os dias e os
  // turnos que algum carrinho tem configurados; os que não têm nenhuma vaga que o publicador
  // possa pedir ficam desabilitados. Na última etapa, só os carrinhos com aquele (dia, turno).
  const diasDisponiveis = useMemo<OpcaoDia[]>(
    () =>
      DIAS_SEMANA.filter((d) => configurado(carrinhos, d.valor, null)).map((d) => ({
        dia: d,
        livre: TURNOS.some((t) => turnoLivre(carrinhos, jaPedidas, d.valor, t.id)),
      })),
    [carrinhos, jaPedidas],
  );

  const turnosDoDia = useMemo<OpcaoTurno[]>(() => {
    if (diaSemana == null) return [];
    return TURNOS.filter((t) => configurado(carrinhos, diaSemana, t.id)).map((turno) => ({
      turno,
      livre: turnoLivre(carrinhos, jaPedidas, diaSemana, turno.id),
    }));
  }, [carrinhos, jaPedidas, diaSemana]);

  const vagasDoTurno = useMemo<VagaCarrinho[]>(() => {
    if (diaSemana == null || turnoId == null) return [];
    return carrinhos.flatMap((carrinho) => {
      const d = carrinho.disponibilidades.find((x) => x.diaSemana === diaSemana && x.turnoId === turnoId);
      return d
        ? [
            {
              carrinho,
              ocupacao: d.ocupacao,
              cheia: d.cheia,
              jaPedida: jaPedidas.has(chaveVaga(carrinho.id, diaSemana, turnoId)),
            },
          ]
        : [];
    });
  }, [carrinhos, jaPedidas, diaSemana, turnoId]);

  /** Recarga da ocupação (ao chegar no carrinho e quando a vaga encheu no envio). Ao chegar no
   * carrinho a falha é silenciosa — vale a lista já carregada e o backend continua barrando;
   * depois de um VAGA_CHEIA, `aoFalhar` avisa que as vagas na tela podem estar desatualizadas. */
  function recarregarOcupacao(aoFalhar?: () => void) {
    apiFetch<Carrinho[]>("/api/carrinhos")
      .then((resposta) => {
        setCarrinhos(resposta);
        // Vaga escolhida que encheu nesse meio-tempo deixa de valer.
        const atual = resposta.find((c) => c.id === carrinhoId);
        const vaga = atual?.disponibilidades.find((d) => d.diaSemana === diaSemana && d.turnoId === turnoId);
        if (vaga?.cheia) setCarrinhoId(null);
      })
      .catch(() => aoFalhar?.());
  }

  /** Marca na lista local a vaga que o backend disse estar cheia, para desabilitá-la mesmo
   * que a recarga falhe. */
  function marcarVagaCheia(carrinho: number, dia: DiaSemana, turno: number) {
    setCarrinhos((atuais) =>
      atuais.map((c) =>
        c.id !== carrinho
          ? c
          : {
              ...c,
              disponibilidades: c.disponibilidades.map((d) =>
                d.diaSemana === dia && d.turnoId === turno ? { ...d, cheia: true } : d,
              ),
            },
      ),
    );
  }

  const carrinhoSelecionado = carrinhos.find((c) => c.id === carrinhoId);

  function selecionarDia(dia: DiaSemana) {
    setDiaSemana(dia);
    // Turno/carrinho escolhidos antes (usuário voltou etapas) podem não valer nesse novo dia.
    if (turnoId == null) return;
    if (!turnoLivre(carrinhos, jaPedidas, dia, turnoId)) {
      setTurnoId(null);
      setCarrinhoId(null);
    } else if (carrinhoId != null && !podePedir(carrinhoSelecionado, jaPedidas, dia, turnoId)) {
      setCarrinhoId(null);
    }
  }

  function selecionarTurno(turno: number) {
    setTurnoId(turno);
    // O carrinho escolhido antes pode não ter vaga livre nesse novo turno.
    if (diaSemana != null && carrinhoId != null && !podePedir(carrinhoSelecionado, jaPedidas, diaSemana, turno)) {
      setCarrinhoId(null);
    }
  }

  const podeAvancar = etapa === 1 ? diaSemana != null : etapa === 2 ? turnoId != null : carrinhoId != null;

  function voltar() {
    setErroSalvar(null);
    if (etapa === 1) {
      navigate("/");
      return;
    }
    setEtapa((e) => (e - 1) as Etapa);
  }

  async function salvar() {
    if (carrinhoId == null || diaSemana == null || turnoId == null) return;
    setSalvando(true);
    setErroSalvar(null);
    try {
      await apiFetch<SolicitacaoCriadaResponse>("/api/solicitacoes", {
        method: "POST",
        body: JSON.stringify({ nome, carrinhoId, diaSemana, turnoId }),
      });
      navigate("/", { replace: true });
    } catch (err) {
      if (ehErroDeVagaCheia(err)) {
        setCarrinhoId(null);
        marcarVagaCheia(carrinhoId, diaSemana, turnoId);
        setErroSalvar("Essa vaga acabou de ficar cheia. Escolha outro carrinho, turno ou dia.");
        recarregarOcupacao(() =>
          setErroSalvar(
            "Essa vaga acabou de ficar cheia, e não foi possível atualizar as outras vagas. " +
              "Outras também podem estar cheias — se acontecer de novo, volte mais tarde.",
          ),
        );
      } else if (err instanceof ApiError && err.status === 409) {
        setErroSalvar("Você já pediu esse dia e horário nesse carrinho antes. Volte e escolha outra opção.");
      } else if (ehErroDeJanelaFechada(err)) {
        setJanelaFechouAgora(true);
      } else {
        setErroSalvar(err instanceof ApiError ? err.message : "Não foi possível salvar. Tente novamente.");
      }
    } finally {
      setSalvando(false);
    }
  }

  function avancar() {
    if (!podeAvancar) return;
    if (etapa < TOTAL_ETAPAS) {
      // A lista foi carregada ao abrir o wizard; ao chegar no carrinho, atualiza a ocupação.
      if (etapa + 1 === TOTAL_ETAPAS) recarregarOcupacao();
      setEtapa((e) => (e + 1) as Etapa);
      return;
    }
    void salvar();
  }

  if (janelaFechouAgora) {
    return <JanelaFechada />;
  }

  function renderEtapa() {
    switch (etapa) {
      case 1:
        return (
          <EtapaDiaSemana
            dias={diasDisponiveis}
            carregando={carregandoCarrinhos}
            erro={erroCarrinhos}
            valor={diaSemana}
            onSelecionar={selecionarDia}
          />
        );
      case 2:
        return <EtapaTurno turnos={turnosDoDia} valor={turnoId} onSelecionar={selecionarTurno} />;
      case 3:
        return <EtapaCarrinho vagas={vagasDoTurno} valor={carrinhoId} onSelecionar={setCarrinhoId} />;
    }
  }

  return (
    <section className="flex min-h-[60vh] flex-col gap-6">
      {/* Mês-alvo fixo no topo de todas as etapas: o publicador sempre sabe para qual
          escala está pedindo. */}
      <div className="rounded-lg border bg-muted px-4 py-3">
        <p className="text-sm text-muted-foreground">Escala de</p>
        <p className="text-2xl font-bold capitalize">{formatarMes(mesAlvo)}</p>
      </div>

      <WizardProgresso etapa={etapa} total={TOTAL_ETAPAS} />

      <div className="flex flex-1 flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-xl">{TITULOS[etapa]}</h1>
        </div>
        {renderEtapa()}
      </div>

      {erroSalvar && (
        <Alert variant="destructive">
          <AlertDescription>{erroSalvar}</AlertDescription>
        </Alert>
      )}

      <footer className="sticky bottom-0 flex gap-3 bg-background pt-2 pb-1">
        <Button type="button" variant="outline" size="lg" onClick={voltar} disabled={salvando}>
          Voltar
        </Button>
        <Button
          type="button"
          size="lg"
          className="flex-1"
          onClick={avancar}
          disabled={!podeAvancar || salvando}
        >
          {etapa < TOTAL_ETAPAS ? "Continuar" : salvando ? "Salvando…" : "Salvar"}
        </Button>
      </footer>
    </section>
  );
}
