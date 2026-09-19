import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../api/client";
import { DIAS_SEMANA } from "../../constants/diasSemana";
import { TURNOS } from "../../constants/turnos";

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

const STATUS_PENDENTE = 1;
const STATUS_APROVADA = 2;
const STATUS_REJEITADA = 3;
const STATUS_CANCELADA = 4;

const STATUS_LABELS: Record<number, string> = {
  [STATUS_PENDENTE]: "Pendente",
  [STATUS_APROVADA]: "Aprovada",
  [STATUS_REJEITADA]: "Rejeitada",
  [STATUS_CANCELADA]: "Cancelada",
};

function formatarMesReferencia(iso: string): string {
  const data = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(data.getTime())) {
    return iso;
  }
  return data.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function formatarDataHora(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) {
    return iso;
  }
  return data.toLocaleString("pt-BR");
}

function labelDiaSemana(diaSemana: number): string {
  return DIAS_SEMANA.find((d) => d.valor === diaSemana)?.label ?? `Dia ${diaSemana}`;
}

function labelTurno(turnoId: number): string {
  const turno = TURNOS.find((t) => t.id === turnoId);
  return turno ? `${turno.horaInicio}–${turno.horaFim}` : `Turno ${turnoId}`;
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

  return (
    <section>
      <h1>Meu histórico de solicitações</h1>

      {carregando && <p>Carregando histórico...</p>}

      {!carregando && erroCarregamento && (
        <p role="alert" className="historico__erro">
          {erroCarregamento}
        </p>
      )}

      {!carregando && !erroCarregamento && solicitacoes && solicitacoes.length === 0 && (
        <p>Nenhuma solicitação enviada ainda.</p>
      )}

      {!carregando && !erroCarregamento && solicitacoes && solicitacoes.length > 0 && (
        <table className="historico__tabela">
          <thead>
            <tr>
              <th>Mês</th>
              <th>Carrinho</th>
              <th>Dia</th>
              <th>Turno</th>
              <th>Status</th>
              <th>Enviado em</th>
              <th aria-label="Ações"></th>
            </tr>
          </thead>
          <tbody>
            {solicitacoes.map((solicitacao) => {
              const podeCancelar =
                solicitacao.status === STATUS_PENDENTE || solicitacao.status === STATUS_APROVADA;
              const erroCancelamento = errosCancelamento[solicitacao.id];

              return (
                <tr key={solicitacao.id}>
                  <td>{formatarMesReferencia(solicitacao.escalaMesReferencia)}</td>
                  <td>{solicitacao.carrinhoNome}</td>
                  <td>{labelDiaSemana(solicitacao.diaSemana)}</td>
                  <td>{labelTurno(solicitacao.turnoId)}</td>
                  <td>{STATUS_LABELS[solicitacao.status] ?? `Status ${solicitacao.status}`}</td>
                  <td>{formatarDataHora(solicitacao.criadoEm)}</td>
                  <td>
                    {podeCancelar && (
                      <>
                        <button
                          type="button"
                          onClick={() => void cancelarSolicitacao(solicitacao.id)}
                          disabled={cancelandoId === solicitacao.id}
                        >
                          {cancelandoId === solicitacao.id ? "Cancelando..." : "Cancelar"}
                        </button>
                        {erroCancelamento && (
                          <p role="alert" className="historico__erro historico__erro--linha">
                            {erroCancelamento}
                          </p>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
