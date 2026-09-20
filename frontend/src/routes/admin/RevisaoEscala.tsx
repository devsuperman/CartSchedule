import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiFetch, ApiError } from "../../api/client";
import {
  formatarDia,
  formatarMes,
  formatarTurno,
  STATUS,
  STATUS_CLASSES,
  STATUS_LABELS,
} from "../../utils/formatacao";

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

const ORIGEM_LABELS: Record<number, string> = {
  1: "Publicador",
  2: "Administrador",
};

const STATUS_PENDENTE = STATUS.Pendente;

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
    return <p className="carregando">Carregando solicitações…</p>;
  }

  if (erroCarregamento) {
    return (
      <p role="alert" className="aviso aviso--erro">
        {erroCarregamento}
      </p>
    );
  }

  if (!dados || dados.grupos.length === 0) {
    return (
      <div className="estado-vazio painel">
        <strong>Nenhum pedido nesta escala</strong>
        Quando publicadores enviarem pedidos, eles aparecem aqui.
      </div>
    );
  }

  const todas = dados.grupos.flatMap((g) => g.solicitacoes);
  const contar = (status: number) => todas.filter((x) => x.status === status).length;
  const excedentes = dados.grupos.filter((g) => g.excedente).length;

  return (
    <section className="pilha">
      <div className="pagina-titulo">
        <h1>Revisão da escala</h1>
        <p className="subtitulo">
          {formatarMes(dados.mes)}. O limite é de 2 pessoas por vaga, mas você decide quando ajustar.
        </p>
      </div>

      <dl className="resumo">
        <div>
          <dt>Recebidos</dt>
          <dd>{todas.length}</dd>
        </div>
        <div>
          <dt>Pendentes</dt>
          <dd>{contar(STATUS.Pendente)}</dd>
        </div>
        <div>
          <dt>Aprovados</dt>
          <dd>{contar(STATUS.Aprovada)}</dd>
        </div>
        <div>
          <dt>Rejeitados</dt>
          <dd>{contar(STATUS.Rejeitada)}</dd>
        </div>
        <div>
          <dt>Vagas com excesso</dt>
          <dd>{excedentes}</dd>
        </div>
      </dl>

      {dados.grupos.map((grupo) => {
        const ativos = grupo.solicitacoes.filter(
          (x) => x.status === STATUS.Pendente || x.status === STATUS.Aprovada,
        ).length;

        return (
          <div
            key={`${grupo.carrinhoId}-${grupo.diaSemana}-${grupo.turnoId}`}
            className={`vaga${grupo.excedente ? " vaga--excedente" : ""}`}
          >
            <div className="vaga__cabecalho">
              <div>
                <h2>{grupo.carrinhoNome}</h2>
                <span className="vaga__quando">
                  {formatarDia(grupo.diaSemana)}, {formatarTurno(grupo.turnoId)}
                </span>
              </div>
              {grupo.excedente && (
                <span className="chip chip--excedente">{ativos} pedidos para 2 vagas</span>
              )}
            </div>
            <ul className="vaga__lista">
              {grupo.solicitacoes.map((solicitacao) => (
                <li key={solicitacao.id}>
                  <div className="vaga__pessoa">
                    <strong>{solicitacao.publicadorNome}</strong>
                    <span className="vaga__apoio">
                      {solicitacao.totalNaEscala}{" "}
                      {solicitacao.totalNaEscala === 1 ? "pedido" : "pedidos"} nesta escala
                      {solicitacao.origem !== 1 &&
                        `, adicionado pelo ${ORIGEM_LABELS[solicitacao.origem]?.toLowerCase() ?? "sistema"}`}
                    </span>
                  </div>
                  <div className="vaga__acoes">
                    <span className={`chip ${STATUS_CLASSES[solicitacao.status] ?? ""}`}>
                      {STATUS_LABELS[solicitacao.status] ?? "Desconhecido"}
                    </span>
                    {solicitacao.status === STATUS_PENDENTE && (
                      <>
                        <button
                          type="button"
                          className="btn--aprovar btn--pequeno"
                          disabled={processando[solicitacao.id] === true}
                          onClick={() => decidir(solicitacao.id, "aprovar")}
                        >
                          Aprovar
                        </button>
                        <button
                          type="button"
                          className="btn--perigo btn--pequeno"
                          disabled={processando[solicitacao.id] === true}
                          onClick={() => decidir(solicitacao.id, "rejeitar")}
                        >
                          Rejeitar
                        </button>
                      </>
                    )}
                  </div>
                  {errosAcao[solicitacao.id] && (
                    <p role="alert" className="aviso aviso--erro aviso--linha" style={{ flexBasis: "100%" }}>
                      {errosAcao[solicitacao.id]}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
