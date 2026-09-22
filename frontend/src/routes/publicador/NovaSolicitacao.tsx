import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, ApiError } from "../../api/client";
import { usePublicadorToken } from "../../hooks/usePublicadorToken";
import { useJanela } from "../../hooks/useJanela";
import { TURNOS } from "../../constants/turnos";
import { DIAS_SEMANA, type DiaSemana } from "../../constants/diasSemana";
import { formatarDia, formatarMes, formatarTurno } from "../../utils/formatacao";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

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
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <h1>Nova solicitação</h1>
        {janela?.mesAlvo && (
          <p className="text-muted-foreground">
            Escala de {formatarMes(janela.mesAlvo)}. Cada dia escolhido vale para todas as
            semanas do mês.
          </p>
        )}
      </div>

      <Card>
        <Label className="flex flex-col items-start gap-1.5">
          Seu nome
          <Input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            autoComplete="name"
            required
          />
          <span className="text-sm font-normal text-muted-foreground">
            Fica salvo neste aparelho para as próximas vezes.
          </span>
        </Label>
      </Card>

      {carregandoCarrinhos && <p className="text-muted-foreground">Carregando carrinhos…</p>}
      {erroCarrinhos && (
        <Alert variant="destructive">
          <AlertDescription>{erroCarrinhos}</AlertDescription>
        </Alert>
      )}

      {!carregandoCarrinhos && !erroCarrinhos && carrinhos.length === 0 && (
        <Card className="items-center gap-2 py-10 text-center text-muted-foreground">
          <strong className="block text-[1.1rem] text-foreground">Nenhum carrinho disponível</strong>
          Volte mais tarde, quando o administrador cadastrar os carrinhos.
        </Card>
      )}

      {!carregandoCarrinhos && carrinhos.length > 0 && (
        <Card className="gap-4">
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 font-semibold">Carrinho</legend>
            <div className="flex flex-wrap gap-2">
              {carrinhos.map((c) => (
                <Button
                  key={c.id}
                  type="button"
                  variant="outline"
                  aria-pressed={c.id === carrinhoId}
                  className={cn(
                    "aria-pressed:border-secondary aria-pressed:bg-secondary aria-pressed:text-secondary-foreground",
                  )}
                  onClick={() => setCarrinhoId(c.id)}
                >
                  {c.nome}
                </Button>
              ))}
            </div>
          </fieldset>

          {turnosDisponiveis.length === 0 ? (
            <Alert>
              <AlertDescription>Este carrinho não tem turnos disponíveis.</AlertDescription>
            </Alert>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Toque nos horários em que você quer trabalhar em {carrinhoSelecionado?.nome}.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full border-separate border-spacing-1 tabular-nums">
                  <thead>
                    <tr>
                      <th scope="col">
                        <span className="sr-only">Turno</span>
                      </th>
                      {DIAS_SEMANA.map((d) => (
                        <th
                          key={d.valor}
                          scope="col"
                          abbr={d.label}
                          className="p-1 text-center text-sm font-semibold text-muted-foreground"
                        >
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
                          <th
                            scope="row"
                            className="whitespace-nowrap pr-2 text-left text-sm font-semibold"
                          >
                            {turno.horaInicio}–{turno.horaFim}
                          </th>
                          {DIAS_SEMANA.map((d) => {
                            const marcado = pendentesDoCarrinho(d.valor, turno.id);
                            return (
                              <td key={d.valor} className="p-0">
                                <button
                                  type="button"
                                  aria-pressed={marcado}
                                  aria-label={`${d.label}, ${formatarTurno(turno.id)}`}
                                  disabled={!disponivel}
                                  onClick={() => handleAlternarCelula(d.valor, turno.id)}
                                  className={cn(
                                    "min-h-12 w-full min-w-11 rounded-lg border border-border text-xl leading-none transition-colors",
                                    disponivel
                                      ? "bg-muted/40 hover:bg-muted"
                                      : "cursor-not-allowed border-transparent bg-[repeating-linear-gradient(135deg,var(--color-background),var(--color-background)_5px,var(--color-muted)_5px,var(--color-muted)_10px)]",
                                    marcado && "border-primary bg-primary text-primary-foreground hover:bg-primary",
                                  )}
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
                <p className="text-[0.8rem] text-muted-foreground">
                  Você também escolheu {totalEmOutrosCarrinhos} horário(s) em outros carrinhos.
                </p>
              )}
            </>
          )}
        </Card>
      )}

      {confirmacao && (
        <Alert variant="success">
          <AlertDescription>
            {confirmacao} Acompanhe em <Link to="/historico">Meu histórico</Link>.
          </AlertDescription>
        </Alert>
      )}

      {resultados && (
        <ul className="flex list-none flex-col gap-2 p-0">
          {resultados.map((r) => (
            <li key={r.chaveLocal}>
              <Alert variant={r.sucesso ? "success" : "destructive"}>
                <AlertDescription>{r.mensagem}</AlertDescription>
              </Alert>
            </li>
          ))}
        </ul>
      )}

      {pendentes.length > 0 && (
        <div
          className="sticky bottom-0 flex flex-col gap-3 rounded-lg border border-border-strong bg-card p-4 shadow-[0_-6px_16px_rgba(27,42,58,0.08)]"
          aria-label="Resumo do pedido"
        >
          <h2>
            {pendentes.length === 1 ? "1 horário escolhido" : `${pendentes.length} horários escolhidos`}
          </h2>
          <ul className="flex list-none flex-col gap-1.5 p-0">
            {pendentes.map((item) => (
              <li key={item.chaveLocal} className="flex items-center justify-between gap-3">
                <span>
                  <strong>{nomeCarrinho(item.carrinhoId)}</strong>, {formatarDia(item.diaSemana)},{" "}
                  {formatarTurno(item.turnoId)}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleRemover(item.chaveLocal)}
                >
                  Remover
                </Button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={() => void handleEnviar()}
              disabled={enviando || nomeVazio}
            >
              {enviando ? "Enviando…" : "Enviar solicitações"}
            </Button>
            {nomeVazio && (
              <span className="min-w-40 flex-1 text-sm text-muted-foreground">
                Digite seu nome para enviar.
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
