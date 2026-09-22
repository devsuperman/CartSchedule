import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../api/client";
import { Link } from "react-router-dom";
import {
  formatarDia,
  formatarMes,
  formatarTurno,
  STATUS,
  STATUS_BADGE_VARIANT,
  STATUS_LABELS,
} from "../../utils/formatacao";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <h1>Meu histórico</h1>
        <p className="text-muted-foreground">
          Você pode cancelar um pedido pendente ou aprovado a qualquer momento.
        </p>
      </div>

      {carregando && <p className="text-muted-foreground">Carregando histórico…</p>}

      {!carregando && erroCarregamento && (
        <Alert variant="destructive">
          <AlertDescription>{erroCarregamento}</AlertDescription>
        </Alert>
      )}

      {!carregando && !erroCarregamento && solicitacoes && solicitacoes.length === 0 && (
        <Card className="items-center gap-2 py-10 text-center text-muted-foreground">
          <strong className="block text-[1.1rem] text-foreground">
            Você ainda não fez nenhum pedido
          </strong>
          <Link to="/">Escolher horários</Link>
        </Card>
      )}

      {[...porMes.entries()].map(([mes, lista]) => (
        <div key={mes} className="flex flex-col gap-4">
          <h2 className="mt-2 text-base font-normal text-muted-foreground capitalize">
            {formatarMes(mes)}
          </h2>
          <ul className="flex list-none flex-col gap-3 p-0">
            {lista.map((solicitacao) => {
              const podeCancelar =
                solicitacao.status === STATUS_PENDENTE || solicitacao.status === STATUS_APROVADA;
              const erroCancelamento = errosCancelamento[solicitacao.id];

              return (
                <li key={solicitacao.id}>
                  <Card className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 p-4 sm:p-5">
                    <span className="text-[1.05rem] font-bold">{solicitacao.carrinhoNome}</span>
                    <span className="row-span-2 flex flex-col items-end gap-2">
                      <Badge variant={STATUS_BADGE_VARIANT[solicitacao.status]}>
                        {STATUS_LABELS[solicitacao.status] ?? `Status ${solicitacao.status}`}
                      </Badge>
                      {podeCancelar && (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => void cancelarSolicitacao(solicitacao.id)}
                          disabled={cancelandoId === solicitacao.id}
                        >
                          {cancelandoId === solicitacao.id ? "Cancelando…" : "Cancelar pedido"}
                        </Button>
                      )}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {formatarDia(solicitacao.diaSemana)}, {formatarTurno(solicitacao.turnoId)}. Enviado em{" "}
                      {formatarDataHora(solicitacao.criadoEm)}
                    </span>
                    {erroCancelamento && (
                      <Alert variant="destructive" className="col-span-full py-2 text-[0.95rem]">
                        <AlertDescription>{erroCancelamento}</AlertDescription>
                      </Alert>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}
