import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../api/client";
import { Link } from "react-router-dom";
import {
  formatarDia,
  formatarMes,
  formatarTurno,
  STATUS,
  STATUS_CLASSES,
  STATUS_LABELS,
} from "../../utils/formatacao";

/** Contrato de GET /api/solicitacoes (uma solicitação do publicador autenticado via token). */
interface Solicitacao {
  id: number;
  escalaMesReferencia: string;
  carrinhoId: number;
  carrinhoNome: string;
  diaSemana: number;
  turnoId: number;
  status: number;
  origem: number;
  criadoEm: string;
}

const STATUS_PENDENTE = STATUS.Pendente;
const STATUS_APROVADA = STATUS.Aprovada;
const STATUS_CANCELADA = STATUS.Cancelada;

function formatarDataHora(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) {
    return iso;
  }
  return data.toLocaleString("pt-BR");
}

export default function Historico() {
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[] | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);
  const [cancelandoId, setCancelandoId] = useState<number | null>(null);
  const [errosCancelamento, setErrosCancelamento] = useState<Record<number, string>>({});

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      setCarregando(true);
      setErroCarregamento(null);
      try {
        const dados = await apiFetch<Solicitacao[]>("/api/solicitacoes");
        if (!cancelado) {
          setSolicitacoes(dados);
        }
      } catch (erro) {
        if (!cancelado) {
          const mensagem =
            erro instanceof ApiError
              ? erro.message
              : "Não foi possível carregar o histórico. Tente novamente.";
          setErroCarregamento(mensagem);
        }
      } finally {
        if (!cancelado) {
          setCarregando(false);
        }
      }
    }

    void carregar();

    return () => {
      cancelado = true;
    };
  }, []);

  async function cancelarSolicitacao(id: number) {
    setCancelandoId(id);
    setErrosCancelamento((prev) => {
      const { [id]: _removido, ...resto } = prev;
      return resto;
    });

    try {
      await apiFetch(`/api/solicitacoes/${id}/cancelar`, { method: "POST" });
      setSolicitacoes((prev) =>
        prev
          ? prev.map((solicitacao) =>
              solicitacao.id === id
                ? { ...solicitacao, status: STATUS_CANCELADA }
                : solicitacao,
            )
          : prev,
      );
    } catch (erro) {
      const mensagem =
        erro instanceof ApiError
          ? erro.message
          : "Não foi possível cancelar a solicitação. Tente novamente.";
      setErrosCancelamento((prev) => ({ ...prev, [id]: mensagem }));
    } finally {
      setCancelandoId(null);
    }
  }

  const porMes = new Map<string, Solicitacao[]>();
  for (const solicitacao of solicitacoes ?? []) {
    const lista = porMes.get(solicitacao.escalaMesReferencia) ?? [];
    lista.push(solicitacao);
    porMes.set(solicitacao.escalaMesReferencia, lista);
  }

  return (
    <section className="pilha">
      <div className="pagina-titulo">
        <h1>Meu histórico</h1>
        <p className="subtitulo">Você pode cancelar um pedido pendente ou aprovado a qualquer momento.</p>
      </div>

      {carregando && <p className="carregando">Carregando histórico…</p>}

      {!carregando && erroCarregamento && (
        <p role="alert" className="aviso aviso--erro">
          {erroCarregamento}
        </p>
      )}

      {!carregando && !erroCarregamento && solicitacoes && solicitacoes.length === 0 && (
        <div className="estado-vazio painel">
          <strong>Você ainda não fez nenhum pedido</strong>
          <Link to="/">Escolher horários</Link>
        </div>
      )}

      {[...porMes.entries()].map(([mes, lista]) => (
        <div key={mes} className="pilha">
          <h2 className="mes-titulo">{formatarMes(mes)}</h2>
          <ul className="lista-cartoes">
            {lista.map((solicitacao) => {
              const podeCancelar =
                solicitacao.status === STATUS_PENDENTE || solicitacao.status === STATUS_APROVADA;
              const erroCancelamento = errosCancelamento[solicitacao.id];

              return (
                <li key={solicitacao.id} className="cartao">
                  <span className="cartao__titulo">{solicitacao.carrinhoNome}</span>
                  <span className="cartao__meta">
                    {formatarDia(solicitacao.diaSemana)}, {formatarTurno(solicitacao.turnoId)}. Enviado em{" "}
                    {formatarDataHora(solicitacao.criadoEm)}
                  </span>
                  <div className="cartao__lado">
                    <span className={`chip ${STATUS_CLASSES[solicitacao.status] ?? ""}`}>
                      {STATUS_LABELS[solicitacao.status] ?? `Status ${solicitacao.status}`}
                    </span>
                    {podeCancelar && (
                      <button
                        type="button"
                        className="btn--perigo btn--pequeno"
                        onClick={() => void cancelarSolicitacao(solicitacao.id)}
                        disabled={cancelandoId === solicitacao.id}
                      >
                        {cancelandoId === solicitacao.id ? "Cancelando…" : "Cancelar pedido"}
                      </button>
                    )}
                  </div>
                  {erroCancelamento && (
                    <p role="alert" className="aviso aviso--erro aviso--linha cartao__erro">
                      {erroCancelamento}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}
