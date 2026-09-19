import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiFetch, ApiError } from "../../api/client";
import { DIAS_SEMANA } from "../../constants/diasSemana";
import { TURNOS } from "../../constants/turnos";

/** Contrato de GET /api/admin/escalas/{mes}/solicitacoes (TECHNICAL_SPEC.md, tarefa F2-BE-04). */
interface SolicitacaoAgrupada {
  id: number;
  publicadorId: string;
  publicadorNome: string;
  status: number; // 1=Pendente,2=Aprovada,3=Rejeitada,4=Cancelada
  origem: number; // 1=Publicador,2=Administrador
  criadoEm: string;
  totalNaEscala: number;
}

interface GrupoSolicitacoes {
  carrinhoId: number;
  carrinhoNome: string;
  diaSemana: number;
  turnoId: number;
  excedente: boolean;
  solicitacoes: SolicitacaoAgrupada[];
}

interface RespostaSolicitacoesAgrupadas {
  mes: string;
  grupos: GrupoSolicitacoes[];
}

const STATUS_LABELS: Record<number, string> = {
  1: "Pendente",
  2: "Aprovada",
  3: "Rejeitada",
  4: "Cancelada",
};

const ORIGEM_LABELS: Record<number, string> = {
  1: "Publicador",
  2: "Administrador",
};

const STATUS_PENDENTE = 1;

function turnoLabel(turnoId: number): string {
  const turno = TURNOS.find((t) => t.id === turnoId);
  return turno ? `${turno.horaInicio}–${turno.horaFim}` : `Turno ${turnoId}`;
}

function diaLabel(diaSemana: number): string {
  const dia = DIAS_SEMANA.find((d) => d.valor === diaSemana);
  return dia ? dia.label : `Dia ${diaSemana}`;
}

function mensagemErro(erro: unknown, fallback: string): string {
  return erro instanceof ApiError ? erro.message : fallback;
}

type Acao = "aprovar" | "rejeitar";

export default function RevisaoEscala() {
  const { mes } = useParams<{ mes: string }>();
  const [dados, setDados] = useState<RespostaSolicitacoesAgrupadas | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);
  const [processando, setProcessando] = useState<Record<number, boolean>>({});
  const [errosAcao, setErrosAcao] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!mes) {
      setErroCarregamento("Mês inválido.");
      setCarregando(false);
      return;
    }

    let cancelado = false;
    setCarregando(true);
    setErroCarregamento(null);

    apiFetch<RespostaSolicitacoesAgrupadas>(`/api/admin/escalas/${mes}/solicitacoes`)
      .then((resposta) => {
        if (!cancelado) {
          setDados(resposta);
        }
      })
      .catch((erro) => {
        if (!cancelado) {
          setErroCarregamento(mensagemErro(erro, "Não foi possível carregar as solicitações desta escala."));
        }
      })
      .finally(() => {
        if (!cancelado) {
          setCarregando(false);
        }
      });

    return () => {
      cancelado = true;
    };
  }, [mes]);

  async function decidir(id: number, acao: Acao) {
    setProcessando((atual) => ({ ...atual, [id]: true }));
    setErrosAcao((atual) => {
      const { [id]: _removido, ...resto } = atual;
      return resto;
    });

    try {
      const resposta = await apiFetch<{ id: number; status: number }>(`/api/admin/solicitacoes/${id}/${acao}`, {
        method: "POST",
      });

      setDados((atual) =>
        atual
          ? {
              ...atual,
              grupos: atual.grupos.map((grupo) => ({
                ...grupo,
                solicitacoes: grupo.solicitacoes.map((solicitacao) =>
                  solicitacao.id === resposta.id ? { ...solicitacao, status: resposta.status } : solicitacao,
                ),
              })),
            }
          : atual,
      );
    } catch (erro) {
      setErrosAcao((atual) => ({
        ...atual,
        [id]: mensagemErro(erro, acao === "aprovar" ? "Falha ao aprovar." : "Falha ao rejeitar."),
      }));
    } finally {
      setProcessando((atual) => ({ ...atual, [id]: false }));
    }
  }

  if (carregando) {
    return <p>Carregando solicitações...</p>;
  }

  if (erroCarregamento) {
    return <p role="alert">{erroCarregamento}</p>;
  }

  if (!dados || dados.grupos.length === 0) {
    return <p>Nenhuma solicitação recebida para esta escala.</p>;
  }

  return (
    <section>
      <h1>Revisão da escala — {dados.mes}</h1>
      {dados.grupos.map((grupo) => (
        <div
          key={`${grupo.carrinhoId}-${grupo.diaSemana}-${grupo.turnoId}`}
          className={`grupo-solicitacoes${grupo.excedente ? " grupo-solicitacoes--excedente" : ""}`}
        >
          <div className="grupo-solicitacoes__header">
            <strong>
              {grupo.carrinhoNome} · {diaLabel(grupo.diaSemana)} · {turnoLabel(grupo.turnoId)}
            </strong>
            {grupo.excedente && <span className="badge badge--excedente">excedente</span>}
          </div>
          <ul className="grupo-solicitacoes__lista">
            {grupo.solicitacoes.map((solicitacao) => (
              <li key={solicitacao.id}>
                <span>
                  {solicitacao.publicadorNome} ({solicitacao.totalNaEscala} solicitações nesta escala) —{" "}
                  {STATUS_LABELS[solicitacao.status] ?? "Desconhecido"} · {ORIGEM_LABELS[solicitacao.origem] ?? "—"}
                </span>
                {solicitacao.status === STATUS_PENDENTE && (
                  <span className="grupo-solicitacoes__acoes">
                    <button
                      type="button"
                      disabled={processando[solicitacao.id] === true}
                      onClick={() => decidir(solicitacao.id, "aprovar")}
                    >
                      Aprovar
                    </button>
                    <button
                      type="button"
                      disabled={processando[solicitacao.id] === true}
                      onClick={() => decidir(solicitacao.id, "rejeitar")}
                    >
                      Rejeitar
                    </button>
                  </span>
                )}
                {errosAcao[solicitacao.id] && (
                  <p role="alert" className="grupo-solicitacoes__erro-acao">
                    {errosAcao[solicitacao.id]}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
