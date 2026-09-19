import { useEffect, useMemo, useState } from "react";
import { apiFetch, ApiError } from "../../api/client";
import { usePublicadorToken } from "../../hooks/usePublicadorToken";
import { useJanela } from "../../hooks/useJanela";
import { TURNOS } from "../../constants/turnos";
import { DIAS_SEMANA, type DiaSemana } from "../../constants/diasSemana";

/** Contrato de GET /api/carrinhos (TECHNICAL_SPEC.md, tarefa F1-BE-02). */
interface Carrinho {
  id: number;
  nome: string;
  turnoIds: number[];
}

/** Contrato de POST /api/solicitacoes (TECHNICAL_SPEC.md, tarefa F1-BE-03). */
interface SolicitacaoResponse {
  id: number;
  carrinhoId: number;
  diaSemana: DiaSemana;
  turnoId: number;
  status: string;
  criadoEm: string;
}

interface ItemPendente {
  /** Identificador local, só para renderizar/remover a linha antes de enviar. */
  chaveLocal: string;
  carrinhoId: number;
  diaSemana: DiaSemana;
  turnoId: number;
}

interface ResultadoEnvio {
  chaveLocal: string;
  sucesso: boolean;
  mensagem: string;
}

function formatarTurno(turnoId: number): string {
  const turno = TURNOS.find((t) => t.id === turnoId);
  return turno ? `${turno.horaInicio}–${turno.horaFim}` : `Turno ${turnoId}`;
}

function formatarDia(diaSemana: DiaSemana): string {
  return DIAS_SEMANA.find((d) => d.valor === diaSemana)?.label ?? String(diaSemana);
}

export default function NovaSolicitacao() {
  const { nome, setNome } = usePublicadorToken();
  const { janela } = useJanela();

  const [carrinhos, setCarrinhos] = useState<Carrinho[]>([]);
  const [carregandoCarrinhos, setCarregandoCarrinhos] = useState(true);
  const [erroCarrinhos, setErroCarrinhos] = useState<string | null>(null);

  const [carrinhoId, setCarrinhoId] = useState<number | null>(null);
  const [diaSemana, setDiaSemana] = useState<DiaSemana>(DIAS_SEMANA[0].valor);
  const [turnoId, setTurnoId] = useState<number | null>(null);

  const [pendentes, setPendentes] = useState<ItemPendente[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [resultados, setResultados] = useState<ResultadoEnvio[] | null>(null);
  const [confirmacao, setConfirmacao] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;

    apiFetch<Carrinho[]>("/api/carrinhos")
      .then((resposta) => {
        if (cancelado) return;
        setCarrinhos(resposta);
        if (resposta.length > 0) {
          setCarrinhoId(resposta[0].id);
        }
      })
      .catch((erro: unknown) => {
        if (!cancelado) {
          const mensagem =
            erro instanceof ApiError
              ? erro.message
              : "Não foi possível carregar os carrinhos disponíveis.";
          setErroCarrinhos(mensagem);
        }
      })
      .finally(() => {
        if (!cancelado) {
          setCarregandoCarrinhos(false);
        }
      });

    return () => {
      cancelado = true;
    };
  }, []);

  const carrinhoSelecionado = useMemo(
    () => carrinhos.find((c) => c.id === carrinhoId) ?? null,
    [carrinhos, carrinhoId],
  );

  const turnosDisponiveis = useMemo(() => {
    if (!carrinhoSelecionado) return [];
    return TURNOS.filter((t) => carrinhoSelecionado.turnoIds.includes(t.id));
  }, [carrinhoSelecionado]);

  // Sempre que o carrinho mudar, o turno selecionado é revalidado contra o
  // novo conjunto de turnos disponíveis (o turno é restrito ao carrinho).
  useEffect(() => {
    if (turnosDisponiveis.length === 0) {
      setTurnoId(null);
      return;
    }
    if (!turnosDisponiveis.some((t) => t.id === turnoId)) {
      setTurnoId(turnosDisponiveis[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnosDisponiveis]);

  function handleAdicionar() {
    if (carrinhoId == null || turnoId == null) return;

    const jaExiste = pendentes.some(
      (item) =>
        item.carrinhoId === carrinhoId && item.diaSemana === diaSemana && item.turnoId === turnoId,
    );
    if (jaExiste) return;

    setPendentes((atual) => [
      ...atual,
      {
        chaveLocal: `${carrinhoId}-${diaSemana}-${turnoId}-${Date.now()}`,
        carrinhoId,
        diaSemana,
        turnoId,
      },
    ]);
    setResultados(null);
    setConfirmacao(null);
  }

  function handleRemover(chaveLocal: string) {
    setPendentes((atual) => atual.filter((item) => item.chaveLocal !== chaveLocal));
  }

  async function handleEnviar() {
    if (pendentes.length === 0) return;

    setEnviando(true);
    setConfirmacao(null);
    setResultados(null);

    const itensParaEnviar = pendentes;

    const respostas = await Promise.allSettled(
      itensParaEnviar.map((item) =>
        apiFetch<SolicitacaoResponse>("/api/solicitacoes", {
          method: "POST",
          body: JSON.stringify({
            nome,
            carrinhoId: item.carrinhoId,
            diaSemana: item.diaSemana,
            turnoId: item.turnoId,
          }),
        }),
      ),
    );

    const resultadosDetalhados: ResultadoEnvio[] = respostas.map((resultado, indice) => {
      const item = itensParaEnviar[indice];
      const descricaoItem = `${
        carrinhos.find((c) => c.id === item.carrinhoId)?.nome ?? item.carrinhoId
      } · ${formatarDia(item.diaSemana)} · ${formatarTurno(item.turnoId)}`;

      if (resultado.status === "fulfilled") {
        return {
          chaveLocal: item.chaveLocal,
          sucesso: true,
          mensagem: `${descricaoItem}: enviada.`,
        };
      }

      const erro = resultado.reason;
      let mensagemErro = "Erro ao enviar.";
      if (erro instanceof ApiError) {
        mensagemErro =
          erro.status === 409
            ? "Você já tem uma solicitação idêntica enviada."
            : erro.message || "Erro ao enviar.";
      } else if (erro instanceof Error) {
        mensagemErro = erro.message;
      }
      return {
        chaveLocal: item.chaveLocal,
        sucesso: false,
        mensagem: `${descricaoItem}: ${mensagemErro}`,
      };
    });

    setResultados(resultadosDetalhados);

    const chavesComSucesso = new Set(
      resultadosDetalhados.filter((r) => r.sucesso).map((r) => r.chaveLocal),
    );
    const restantes = itensParaEnviar.filter((item) => !chavesComSucesso.has(item.chaveLocal));
    setPendentes(restantes);

    if (restantes.length === 0) {
      setConfirmacao("Todas as solicitações foram enviadas com sucesso.");
      setResultados(null);
    }

    setEnviando(false);
  }

  return (
    <section>
      <h1>Nova solicitação</h1>
      {janela?.mesAlvo && <p>Escala de referência: {janela.mesAlvo}</p>}

      <div className="form-row">
        <label>
          Nome
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Seu nome"
            required
          />
        </label>
      </div>

      {carregandoCarrinhos && <p>Carregando carrinhos...</p>}
      {erroCarrinhos && (
        <p role="alert" className="historico__erro">
          {erroCarrinhos}
        </p>
      )}

      {!carregandoCarrinhos && !erroCarrinhos && carrinhos.length === 0 && (
        <p>Nenhum carrinho disponível no momento.</p>
      )}

      {!carregandoCarrinhos && carrinhos.length > 0 && (
        <div className="form-row">
          <label>
            Carrinho
            <select value={carrinhoId ?? ""} onChange={(e) => setCarrinhoId(Number(e.target.value))}>
              {carrinhos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>

          <label>
            Dia da semana
            <select
              value={diaSemana}
              onChange={(e) => setDiaSemana(Number(e.target.value) as DiaSemana)}
            >
              {DIAS_SEMANA.map((d) => (
                <option key={d.valor} value={d.valor}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Turno
            <select
              value={turnoId ?? ""}
              onChange={(e) => setTurnoId(Number(e.target.value))}
              disabled={turnosDisponiveis.length === 0}
            >
              {turnosDisponiveis.length === 0 && <option value="">Sem turnos disponíveis</option>}
              {turnosDisponiveis.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.horaInicio}–{t.horaFim}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={handleAdicionar}
            disabled={carrinhoId == null || turnoId == null}
          >
            Adicionar
          </button>
        </div>
      )}

      {pendentes.length > 0 && (
        <div>
          <h2>Solicitações a enviar</h2>
          <ul>
            {pendentes.map((item) => (
              <li key={item.chaveLocal}>
                {carrinhos.find((c) => c.id === item.carrinhoId)?.nome ?? item.carrinhoId} ·{" "}
                {formatarDia(item.diaSemana)} · {formatarTurno(item.turnoId)}{" "}
                <button type="button" onClick={() => handleRemover(item.chaveLocal)}>
                  Remover
                </button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => void handleEnviar()} disabled={enviando}>
            {enviando ? "Enviando..." : "Enviar solicitações"}
          </button>
        </div>
      )}

      {confirmacao && <p role="status">{confirmacao}</p>}

      {resultados && (
        <ul>
          {resultados.map((r) => (
            <li key={r.chaveLocal} role={r.sucesso ? "status" : "alert"}>
              {r.mensagem}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
