import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiFetch, ApiError } from "../../api/client";
import { formatarDia, formatarMes, formatarTurno } from "../../utils/formatacao";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** Contrato de GET /api/admin/escalas/{mes}/solicitacoes (TECHNICAL_SPEC.md, tarefa F2-BE-04). */
interface SolicitacaoAgrupada {
  id: number;
  publicadorId: string;
  publicadorNome: string;
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

function mensagemErro(erro: unknown, fallback: string): string {
  return erro instanceof ApiError ? erro.message : fallback;
}

/** Tira a solicitação da resposta e refaz o que depende dela: o excesso do grupo, o total do
 * publicador na escala (contagem de apoio, regra 16) e some com o grupo que ficou vazio. */
function semSolicitacao(dados: RespostaSolicitacoesAgrupadas, id: number): RespostaSolicitacoesAgrupadas {
  const removida = dados.grupos.flatMap((g) => g.solicitacoes).find((s) => s.id === id);
  if (!removida) return dados;

  const grupos = dados.grupos
    .map((grupo) => {
      const solicitacoes = grupo.solicitacoes
        .filter((s) => s.id !== id)
        .map((s) =>
          s.publicadorId === removida.publicadorId ? { ...s, totalNaEscala: s.totalNaEscala - 1 } : s,
        );
      return { ...grupo, solicitacoes, excedente: solicitacoes.length > 2 };
    })
    .filter((grupo) => grupo.solicitacoes.length > 0);

  return { ...dados, grupos };
}

interface Exclusao {
  solicitacao: SolicitacaoAgrupada;
  grupo: GrupoSolicitacoes;
}

/**
 * Revisão da escala pelo administrador. Não há aprovação: todo pedido já conta na escala
 * (PLANNING.md regra 12a). Grupos com mais de 2 pedidos são sinalizados, nunca bloqueados
 * (regras 1/3), e o admin tira quem ele decidir com "Excluir" — definitivo, por isso pede
 * confirmação num modal.
 */
export default function RevisaoEscala() {
  const { mes } = useParams<{ mes: string }>();
  const [dados, setDados] = useState<RespostaSolicitacoesAgrupadas | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<Exclusao | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [errosExclusao, setErrosExclusao] = useState<Record<number, string>>({});

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

  async function excluir(id: number) {
    setExcluindo(true);
    setErrosExclusao((atual) => {
      const { [id]: _removido, ...resto } = atual;
      return resto;
    });

    try {
      await apiFetch(`/api/admin/solicitacoes/${id}`, { method: "DELETE" });
      setDados((atual) => (atual ? semSolicitacao(atual, id) : atual));
    } catch (erro) {
      setErrosExclusao((atual) => ({ ...atual, [id]: mensagemErro(erro, "Falha ao excluir.") }));
    } finally {
      setExcluindo(false);
      setConfirmando(null);
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
  const excedentes = dados.grupos.filter((g) => g.excedente).length;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <h1>Revisão da escala</h1>
        <p className="text-muted-foreground">
          {formatarMes(dados.mes)}. Todos os pedidos já contam na escala. O limite é de 2 pessoas
          por vaga: exclua quem você decidir tirar.
        </p>
      </div>

      <dl className="grid grid-cols-[repeat(auto-fit,minmax(7rem,1fr))] gap-3">
        <Card className="gap-1 p-3">
          <dt className="text-sm text-muted-foreground">Recebidos</dt>
          <dd className="m-0 text-[1.6rem] font-bold tabular-nums">{todas.length}</dd>
        </Card>
        <Card className="gap-1 p-3">
          <dt className="text-sm text-muted-foreground">Vagas com excesso</dt>
          <dd className="m-0 text-[1.6rem] font-bold tabular-nums">{excedentes}</dd>
        </Card>
      </dl>

      {dados.grupos.map((grupo) => {
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
                <Badge variant="excedente">{grupo.solicitacoes.length} pedidos para 2 vagas</Badge>
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
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => setConfirmando({ solicitacao, grupo })}
                  >
                    Excluir
                  </Button>
                  {errosExclusao[solicitacao.id] && (
                    <Alert variant="destructive" className="basis-full py-2 text-[0.95rem]">
                      <AlertDescription>{errosExclusao[solicitacao.id]}</AlertDescription>
                    </Alert>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      <Dialog open={confirmando !== null} onOpenChange={(aberto) => !aberto && !excluindo && setConfirmando(null)}>
        <DialogContent>
          {confirmando && (
            <>
              <DialogHeader>
                <DialogTitle>Excluir pedido?</DialogTitle>
                <DialogDescription>
                  {confirmando.solicitacao.publicadorNome} — {confirmando.grupo.carrinhoNome},{" "}
                  {formatarDia(confirmando.grupo.diaSemana)}, {formatarTurno(confirmando.grupo.turnoId)}. Isso não
                  pode ser desfeito.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline" disabled={excluindo}>
                    Cancelar
                  </Button>
                </DialogClose>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={excluindo}
                  onClick={() => excluir(confirmando.solicitacao.id)}
                >
                  {excluindo ? "Excluindo…" : "Excluir"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
