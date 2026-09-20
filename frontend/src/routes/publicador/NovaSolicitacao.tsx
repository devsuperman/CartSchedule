import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, ApiError } from "../../api/client";
import { usePublicadorToken } from "../../hooks/usePublicadorToken";
import { useJanela } from "../../hooks/useJanela";
import { TURNOS } from "../../constants/turnos";
import { DIAS_SEMANA, type DiaSemana } from "../../constants/diasSemana";
import { formatarDia, formatarMes, formatarTurno } from "../../utils/formatacao";

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

export default function NovaSolicitacao() {
  const { nome, setNome } = usePublicadorToken();
  const { janela } = useJanela();

  const [carrinhos, setCarrinhos] = useState<Carrinho[]>([]);
  const [carregandoCarrinhos, setCarregandoCarrinhos] = useState(true);
  const [erroCarrinhos, setErroCarrinhos] = useState<string | null>(null);

  const [carrinhoId, setCarrinhoId] = useState<number | null>(null);

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

  function chaveDe(carrinho: number, dia: DiaSemana, turno: number) {
    return `${carrinho}-${dia}-${turno}`;
  }

  function handleAlternarCelula(dia: DiaSemana, turno: number) {
    if (carrinhoId == null) return;

    const chave = chaveDe(carrinhoId, dia, turno);
    setResultados(null);
    setConfirmacao(null);
    setPendentes((atual) => {
      if (atual.some((item) => item.chaveLocal === chave)) {
        return atual.filter((item) => item.chaveLocal !== chave);
      }
      return [...atual, { chaveLocal: chave, carrinhoId, diaSemana: dia, turnoId: turno }];
    });
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
      const descricaoItem = `${nomeCarrinho(item.carrinhoId)}, ${formatarDia(item.diaSemana)}, ${formatarTurno(item.turnoId)}`;

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

  const nomeVazio = nome.trim() === "";
  const nomeCarrinho = (id: number) => carrinhos.find((c) => c.id === id)?.nome ?? String(id);
  const pendentesDoCarrinho = (dia: DiaSemana, turno: number) =>
    carrinhoId != null && pendentes.some((i) => i.chaveLocal === chaveDe(carrinhoId, dia, turno));
  const totalEmOutrosCarrinhos = pendentes.filter((i) => i.carrinhoId !== carrinhoId).length;

  return (
    <section className="pilha">
      <div className="pagina-titulo">
        <h1>Nova solicitação</h1>
        {janela?.mesAlvo && (
          <p className="subtitulo">
            Escala de {formatarMes(janela.mesAlvo)}. Cada dia escolhido vale para todas as
            semanas do mês.
          </p>
        )}
      </div>

      <div className="painel pilha">
        <label className="campo">
          Seu nome
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            autoComplete="name"
            required
          />
          <span className="campo__ajuda">Fica salvo neste aparelho para as próximas vezes.</span>
        </label>
      </div>

      {carregandoCarrinhos && <p className="carregando">Carregando carrinhos…</p>}
      {erroCarrinhos && (
        <p role="alert" className="aviso aviso--erro">
          {erroCarrinhos}
        </p>
      )}

      {!carregandoCarrinhos && !erroCarrinhos && carrinhos.length === 0 && (
        <div className="estado-vazio painel">
          <strong>Nenhum carrinho disponível</strong>
          Volte mais tarde, quando o administrador cadastrar os carrinhos.
        </div>
      )}

      {!carregandoCarrinhos && carrinhos.length > 0 && (
        <div className="painel pilha">
          <fieldset className="pilha">
            <legend>Carrinho</legend>
            <div className="seletor-carrinhos">
              {carrinhos.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={c.id === carrinhoId}
                  onClick={() => setCarrinhoId(c.id)}
                >
                  {c.nome}
                </button>
              ))}
            </div>
          </fieldset>

          {turnosDisponiveis.length === 0 ? (
            <p className="aviso aviso--info">Este carrinho não tem turnos disponíveis.</p>
          ) : (
            <>
              <p className="campo__ajuda">
                Toque nos horários em que você quer trabalhar em {carrinhoSelecionado?.nome}.
              </p>
              <div className="grade-wrap">
                <table className="grade">
                  <thead>
                    <tr>
                      <th scope="col">
                        <span className="sr-only">Turno</span>
                      </th>
                      {DIAS_SEMANA.map((d) => (
                        <th key={d.valor} scope="col" abbr={d.label}>
                          {d.curto}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {TURNOS.map((turno) => {
                      const disponivel = turnosDisponiveis.some((t) => t.id === turno.id);
                      return (
                        <tr key={turno.id}>
                          <th scope="row">
                            {turno.horaInicio}–{turno.horaFim}
                          </th>
                          {DIAS_SEMANA.map((d) => {
                            const marcado = pendentesDoCarrinho(d.valor, turno.id);
                            return (
                              <td key={d.valor}>
                                <button
                                  type="button"
                                  aria-pressed={marcado}
                                  aria-label={`${d.label}, ${formatarTurno(turno.id)}`}
                                  disabled={!disponivel}
                                  onClick={() => handleAlternarCelula(d.valor, turno.id)}
                                >
                                  {marcado ? "✓" : ""}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {totalEmOutrosCarrinhos > 0 && (
                <p className="grade__outro">
                  Você também escolheu {totalEmOutrosCarrinhos} horário(s) em outros carrinhos.
                </p>
              )}
            </>
          )}
        </div>
      )}

      {confirmacao && (
        <p role="status" className="aviso aviso--sucesso">
          {confirmacao} Acompanhe em <Link to="/historico">Meu histórico</Link>.
        </p>
      )}

      {resultados && (
        <ul className="pilha" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {resultados.map((r) => (
            <li
              key={r.chaveLocal}
              role={r.sucesso ? "status" : "alert"}
              className={`aviso ${r.sucesso ? "aviso--sucesso" : "aviso--erro"}`}
            >
              {r.mensagem}
            </li>
          ))}
        </ul>
      )}

      {pendentes.length > 0 && (
        <div className="pedido" aria-label="Resumo do pedido">
          <h2>
            {pendentes.length === 1 ? "1 horário escolhido" : `${pendentes.length} horários escolhidos`}
          </h2>
          <ul className="pedido__lista">
            {pendentes.map((item) => (
              <li key={item.chaveLocal}>
                <span>
                  <strong>{nomeCarrinho(item.carrinhoId)}</strong>, {formatarDia(item.diaSemana)},{" "}
                  {formatarTurno(item.turnoId)}
                </span>
                <button
                  type="button"
                  className="btn--pequeno"
                  onClick={() => handleRemover(item.chaveLocal)}
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
          <div className="pedido__acoes">
            <button
              type="button"
              className="btn--primario"
              onClick={() => void handleEnviar()}
              disabled={enviando || nomeVazio}
            >
              {enviando ? "Enviando…" : "Enviar solicitações"}
            </button>
            {nomeVazio && <span className="campo__ajuda">Digite seu nome para enviar.</span>}
          </div>
        </div>
      )}
    </section>
  );
}
