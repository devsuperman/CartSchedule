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
import { WizardProgresso } from "./WizardProgresso";
import { EtapaNome } from "./EtapaNome";
import { EtapaDiaSemana } from "./EtapaDiaSemana";
import { EtapaCarrinho } from "./EtapaCarrinho";
import { EtapaTurno } from "./EtapaTurno";

/** Contrato de GET /api/carrinhos (TECHNICAL_SPEC.md, tarefas F1-BE-02/F5-BE-01/F6-BE-03):
 * `disponibilidades` são os pares (dia da semana, turno) habilitados no carrinho. */
export interface Carrinho {
  id: number;
  nome: string;
  descricao: string | null;
  disponibilidades: { diaSemana: DiaSemana; turnoId: number }[];
}

function temTurnoNoDia(carrinho: Carrinho, dia: DiaSemana): boolean {
  return carrinho.disponibilidades.some((d) => d.diaSemana === dia);
}

function temTurno(carrinho: Carrinho, dia: DiaSemana, turnoId: number): boolean {
  return carrinho.disponibilidades.some((d) => d.diaSemana === dia && d.turnoId === turnoId);
}

/** Contrato de POST /api/solicitacoes (TECHNICAL_SPEC.md, tarefa F1-BE-03). */
interface SolicitacaoCriadaResponse {
  id: number;
  carrinhoId: number;
  diaSemana: DiaSemana;
  turnoId: number;
}

type Etapa = 1 | 2 | 3 | 4;
const TOTAL_ETAPAS = 4;

const TITULOS: Record<Etapa, string> = {
  1: "Qual é o seu nome?",
  2: "Em qual dia da semana?",
  3: "Em qual carrinho?",
  4: "Em qual turno?",
};

interface SolicitacaoWizardProps {
  /** Primeiro dia do mês-alvo (ISO), vindo de useJanela() no componente pai (SolicitarEscala) —
   * evita buscar a janela de novo aqui. */
  mesAlvo: string;
}

/**
 * Formulário de solicitação em 4 etapas (PLANNING.md §5): nome → dia da semana → carrinho
 * → turno, uma pergunta por tela, com um botão grande de confirmação no rodapé. Cada
 * Etapa* é "burra" (recebe valor + callback, sem estado próprio); este componente guarda
 * todo o estado e faz o submit final.
 */
export function SolicitacaoWizard({ mesAlvo }: SolicitacaoWizardProps) {
  const navigate = useNavigate();
  const { nome, setNome } = usePublicadorToken();

  const [etapa, setEtapa] = useState<Etapa>(1);
  const [diaSemana, setDiaSemana] = useState<DiaSemana | null>(null);
  const [carrinhoId, setCarrinhoId] = useState<number | null>(null);
  const [turnoId, setTurnoId] = useState<number | null>(null);

  const [carrinhos, setCarrinhos] = useState<Carrinho[]>([]);
  const [carregandoCarrinhos, setCarregandoCarrinhos] = useState(true);
  const [erroCarrinhos, setErroCarrinhos] = useState<string | null>(null);

  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  // Corner case: a janela fecha entre o usuário abrir o wizard e enviar (ex: passou da
  // meia-noite do dia 25 enquanto ele preenchia). O backend recusa com codigo
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

    return () => {
      cancelado = true;
    };
  }, []);

  const carrinhoSelecionado = useMemo(
    () => carrinhos.find((c) => c.id === carrinhoId) ?? null,
    [carrinhos, carrinhoId],
  );

  // Os turnos agora dependem do dia (PLANNING.md regra 17): dias sem turno em nenhum
  // carrinho ficam desabilitados, e só aparecem carrinhos/turnos daquele dia.
  const diasComTurno = useMemo(
    () => new Set(carrinhos.flatMap((c) => c.disponibilidades.map((d) => d.diaSemana))),
    [carrinhos],
  );

  const carrinhosDoDia = useMemo(
    () => (diaSemana == null ? [] : carrinhos.filter((c) => temTurnoNoDia(c, diaSemana))),
    [carrinhos, diaSemana],
  );

  const turnosDisponiveis = useMemo(() => {
    if (!carrinhoSelecionado || diaSemana == null) return [];
    return TURNOS.filter((t) => temTurno(carrinhoSelecionado, diaSemana, t.id));
  }, [carrinhoSelecionado, diaSemana]);

  function selecionarDia(dia: DiaSemana) {
    setDiaSemana(dia);
    // Carrinho/turno escolhidos antes (usuário voltou etapas) podem não valer no novo dia.
    if (carrinhoSelecionado && !temTurnoNoDia(carrinhoSelecionado, dia)) {
      setCarrinhoId(null);
      setTurnoId(null);
    } else if (carrinhoSelecionado && turnoId != null && !temTurno(carrinhoSelecionado, dia, turnoId)) {
      setTurnoId(null);
    }
  }

  function selecionarCarrinho(id: number) {
    setCarrinhoId(id);
    setTurnoId(null); // o turno escolhido antes pode não pertencer ao novo carrinho
  }

  const podeAvancar =
    etapa === 1
      ? nome.trim() !== ""
      : etapa === 2
        ? diaSemana != null
        : etapa === 3
          ? carrinhoId != null
          : turnoId != null;

  function voltar() {
    setErroSalvar(null);
    setEtapa((e) => (e > 1 ? ((e - 1) as Etapa) : e));
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
      if (err instanceof ApiError && err.status === 409) {
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
        return <EtapaNome nome={nome} onChange={setNome} />;
      case 2:
        return (
          <EtapaDiaSemana
            valor={diaSemana}
            diasDisponiveis={carregandoCarrinhos || erroCarrinhos ? null : diasComTurno}
            onSelecionar={selecionarDia}
          />
        );
      case 3:
        return (
          <EtapaCarrinho
            carrinhos={carrinhosDoDia}
            diaLabel={DIAS_SEMANA.find((d) => d.valor === diaSemana)?.label}
            carregando={carregandoCarrinhos}
            erro={erroCarrinhos}
            valor={carrinhoId}
            onSelecionar={selecionarCarrinho}
          />
        );
      case 4:
        return (
          <EtapaTurno
            turnos={turnosDisponiveis}
            carrinhoNome={carrinhoSelecionado?.nome}
            valor={turnoId}
            onSelecionar={setTurnoId}
          />
        );
    }
  }

  return (
    <section className="flex min-h-[60vh] flex-col gap-6">
      <WizardProgresso etapa={etapa} total={TOTAL_ETAPAS} />

      <div className="flex flex-1 flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-xl">{TITULOS[etapa]}</h1>
          {etapa === 2 && (
            <p className="text-sm text-muted-foreground">
              Vale para todas as semanas de {formatarMes(mesAlvo)}.
            </p>
          )}
        </div>
        {renderEtapa()}
      </div>

      {erroSalvar && (
        <Alert variant="destructive">
          <AlertDescription>{erroSalvar}</AlertDescription>
        </Alert>
      )}

      <footer className="sticky bottom-0 flex gap-3 bg-background pt-2 pb-1">
        {etapa > 1 && (
          <Button type="button" variant="outline" size="lg" onClick={voltar} disabled={salvando}>
            Voltar
          </Button>
        )}
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
