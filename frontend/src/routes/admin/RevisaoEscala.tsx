import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiFetch, ApiError } from "../../api/client";
import {
  formatarDia,
  formatarMes,
  formatarTurno,
  STATUS,
  STATUS_BADGE_VARIANT,
  STATUS_LABELS,
} from "../../utils/formatacao";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

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

// O admin pode rever a decisão a qualquer momento (Aprovada <-> Rejeitada); Cancelada foi
// desistência do publicador e não é reativada.
const PODE_APROVAR: readonly number[] = [STATUS.Pendente, STATUS.Rejeitada];
const PODE_REJEITAR: readonly number[] = [STATUS.Pendente, STATUS.Aprovada];

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
    return <p className="text-muted-foreground">Carregando solicitações…</p>;
  }

  if (erroCarregamento) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{erroCarregamento}</AlertDescription>
      </Alert>
    );
  }

  if (!dados || dados.grupos.length === 0) {
    return (
      <Card className="items-center gap-2 py-10 text-center text-muted-foreground">
        <strong className="block text-[1.1rem] text-foreground">Nenhum pedido nesta escala</strong>
        Quando publicadores enviarem pedidos, eles aparecem aqui.
      </Card>
    );
  }

  const todas = dados.grupos.flatMap((g) => g.solicitacoes);
  const contar = (status: number) => todas.filter((x) => x.status === status).length;
  const excedentes = dados.grupos.filter((g) => g.excedente).length;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <h1>Revisão da escala</h1>
        <p className="text-muted-foreground">
          {formatarMes(dados.mes)}. O limite é de 2 pessoas por vaga, mas você decide quando ajustar.
        </p>
      </div>

      <dl className="grid grid-cols-[repeat(auto-fit,minmax(7rem,1fr))] gap-3">
        <Card className="gap-1 p-3">
          <dt className="text-sm text-muted-foreground">Recebidos</dt>
          <dd className="m-0 text-[1.6rem] font-bold tabular-nums">{todas.length}</dd>
        </Card>
        <Card className="gap-1 p-3">
          <dt className="text-sm text-muted-foreground">Pendentes</dt>
          <dd className="m-0 text-[1.6rem] font-bold tabular-nums">{contar(STATUS.Pendente)}</dd>
        </Card>
        <Card className="gap-1 p-3">
          <dt className="text-sm text-muted-foreground">Aprovados</dt>
          <dd className="m-0 text-[1.6rem] font-bold tabular-nums">{contar(STATUS.Aprovada)}</dd>
        </Card>
        <Card className="gap-1 p-3">
          <dt className="text-sm text-muted-foreground">Rejeitados</dt>
          <dd className="m-0 text-[1.6rem] font-bold tabular-nums">{contar(STATUS.Rejeitada)}</dd>
        </Card>
        <Card className="gap-1 p-3">
          <dt className="text-sm text-muted-foreground">Vagas com excesso</dt>
          <dd className="m-0 text-[1.6rem] font-bold tabular-nums">{excedentes}</dd>
        </Card>
      </dl>

      {dados.grupos.map((grupo) => {
        const ativos = grupo.solicitacoes.filter(
          (x) => x.status === STATUS.Pendente || x.status === STATUS.Aprovada,
        ).length;

        return (
          <div
            key={`${grupo.carrinhoId}-${grupo.diaSemana}-${grupo.turnoId}`}
            className={cn(
              "overflow-hidden rounded-lg border border-border bg-card",
              grupo.excedente && "border-destructive shadow-[inset_4px_0_0_var(--color-destructive)]",
            )}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 p-4">
              <div>
                <h2>{grupo.carrinhoNome}</h2>
                <span className="text-muted-foreground tabular-nums">
                  {formatarDia(grupo.diaSemana)}, {formatarTurno(grupo.turnoId)}
                </span>
              </div>
              {grupo.excedente && (
                <Badge variant="rejeitada">{ativos} pedidos para 2 vagas</Badge>
              )}
            </div>
            <ul className="list-none border-t border-border p-0">
              {grupo.solicitacoes.map((solicitacao) => (
                <li
                  key={solicitacao.id}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border p-4 first:border-t-0"
                >
                  <div className="flex flex-col">
                    <strong>{solicitacao.publicadorNome}</strong>
                    <span className="text-sm text-muted-foreground">
                      {solicitacao.totalNaEscala}{" "}
                      {solicitacao.totalNaEscala === 1 ? "pedido" : "pedidos"} nesta escala
                      {solicitacao.origem !== 1 &&
                        `, adicionado pelo ${ORIGEM_LABELS[solicitacao.origem]?.toLowerCase() ?? "sistema"}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={STATUS_BADGE_VARIANT[solicitacao.status]}>
                      {STATUS_LABELS[solicitacao.status] ?? "Desconhecido"}
                    </Badge>
                    {PODE_APROVAR.includes(solicitacao.status) && (
                      <Button
                        type="button"
                        variant="success"
                        size="sm"
                        disabled={processando[solicitacao.id] === true}
                        onClick={() => decidir(solicitacao.id, "aprovar")}
                      >
                        Aprovar
                      </Button>
                    )}
                    {PODE_REJEITAR.includes(solicitacao.status) && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={processando[solicitacao.id] === true}
                        onClick={() => decidir(solicitacao.id, "rejeitar")}
                      >
                        Rejeitar
                      </Button>
                    )}
                  </div>
                  {errosAcao[solicitacao.id] && (
                    <Alert variant="destructive" className="basis-full py-2 text-[0.95rem]">
                      <AlertDescription>{errosAcao[solicitacao.id]}</AlertDescription>
                    </Alert>
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
