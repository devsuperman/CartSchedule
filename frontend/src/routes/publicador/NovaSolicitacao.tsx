import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, ApiError } from "../../api/client";
import { usePublicadorToken } from "../../hooks/usePublicadorToken";
import { useJanela } from "../../hooks/useJanela";
import { TURNOS } from "../../constants/turnos";
import { DIAS_SEMANA, type DiaSemana } from "../../constants/diasSemana";
import { formatarDia, formatarMes, formatarTurno, STATUS } from "../../utils/formatacao";
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
interface SolicitacaoCriadaResponse {
  id: number;
  carrinhoId: number;
  diaSemana: DiaSemana;
  turnoId: number;
}

/** Contrato de GET /api/solicitacoes (TECHNICAL_SPEC.md, tarefa F1-BE-04) — usado aqui só
 * para saber, ao abrir a tela, quais células desta escala já têm solicitação. */
interface SolicitacaoExistente {
  id: number;
  escalaMesReferencia: string;
  carrinhoId: number;
  diaSemana: DiaSemana;
  turnoId: number;
  status: number;
}

/** Estado de uma célula (carrinho, dia, turno) nesta escala. Ausente da tabela = nunca solicitada. */
type EstadoCelula = "enviando" | "enviada" | "cancelando" | "cancelada" | "rejeitada";

interface CelulaInfo {
  estado: EstadoCelula;
  carrinhoId: number;
  solicitacaoId?: number;
}

function chaveDe(carrinho: number, dia: DiaSemana, turno: number) {
  return `${carrinho}-${dia}-${turno}`;
}

export default function NovaSolicitacao() {
  const { nome, setNome } = usePublicadorToken();
  const { janela } = useJanela();

  const [carrinhos, setCarrinhos] = useState<Carrinho[]>([]);
  const [carregandoCarrinhos, setCarregandoCarrinhos] = useState(true);
  const [erroCarrinhos, setErroCarrinhos] = useState<string | null>(null);

  const [carrinhoId, setCarrinhoId] = useState<number | null>(null);

  // Uma entrada por célula (carrinho-dia-turno) já solicitada nesta escala, vinda do
  // histórico do publicador ou de um envio/cancelamento feito nesta própria tela.
  const [celulas, setCelulas] = useState<Record<string, CelulaInfo>>({});
  const [carregandoSolicitacoes, setCarregandoSolicitacoes] = useState(true);
  const [errosCelula, setErrosCelula] = useState<Record<string, string>>({});

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

  // Pré-carrega as solicitações já feitas nesta escala para que a grade mostre o estado
  // real (evita clicar de novo numa célula já enviada/rejeitada/cancelada e levar um erro
  // de duplicidade sem entender por quê).
  useEffect(() => {
    if (!janela?.mesAlvo) return;
    let cancelado = false;

    apiFetch<SolicitacaoExistente[]>("/api/solicitacoes")
      .then((resposta) => {
        if (cancelado) return;
        const doMes = resposta.filter((s) => s.escalaMesReferencia === janela.mesAlvo);
        setCelulas((atual) => {
          const proximo = { ...atual };
          for (const s of doMes) {
            const chave = chaveDe(s.carrinhoId, s.diaSemana, s.turnoId);
            if (s.status === STATUS.Pendente || s.status === STATUS.Aprovada) {
              proximo[chave] = { estado: "enviada", carrinhoId: s.carrinhoId, solicitacaoId: s.id };
            } else if (s.status === STATUS.Rejeitada) {
              proximo[chave] = { estado: "rejeitada", carrinhoId: s.carrinhoId };
            } else {
              proximo[chave] = { estado: "cancelada", carrinhoId: s.carrinhoId };
            }
          }
          return proximo;
        });
      })
      .catch(() => {
        // Melhor esforço: se falhar, a grade só fica sem o estado pré-carregado — o
        // publicador ainda consegue enviar normalmente.
      })
      .finally(() => {
        if (!cancelado) {
          setCarregandoSolicitacoes(false);
        }
      });

    return () => {
      cancelado = true;
    };
  }, [janela?.mesAlvo]);

  const carrinhoSelecionado = useMemo(
    () => carrinhos.find((c) => c.id === carrinhoId) ?? null,
    [carrinhos, carrinhoId],
  );

  const turnosDisponiveis = useMemo(() => {
    if (!carrinhoSelecionado) return [];
    return TURNOS.filter((t) => carrinhoSelecionado.turnoIds.includes(t.id));
  }, [carrinhoSelecionado]);

  const nomeVazio = nome.trim() === "";
  const nomeCarrinho = (id: number) => carrinhos.find((c) => c.id === id)?.nome ?? String(id);

  async function handleClicarCelula(dia: DiaSemana, turno: number) {
    if (carrinhoId == null) return;

    const chave = chaveDe(carrinhoId, dia, turno);
    const atual = celulas[chave];

    setErrosCelula((prev) => {
      if (!(chave in prev)) return prev;
      const { [chave]: _removido, ...resto } = prev;
      return resto;
    });

    // Célula nunca solicitada (ou última tentativa de envio falhou): envia. Exige nome
    // preenchido — cancelar (abaixo) não exige, pois é sempre permitido (regra 8).
    if (!atual) {
      if (nomeVazio) return;
      setCelulas((prev) => ({ ...prev, [chave]: { estado: "enviando", carrinhoId } }));
      try {
        const resposta = await apiFetch<SolicitacaoCriadaResponse>("/api/solicitacoes", {
          method: "POST",
          body: JSON.stringify({ nome, carrinhoId, diaSemana: dia, turnoId: turno }),
        });
        setCelulas((prev) => ({
          ...prev,
          [chave]: { estado: "enviada", carrinhoId, solicitacaoId: resposta.id },
        }));
      } catch (erro) {
        const mensagem =
          erro instanceof ApiError
            ? erro.status === 409
              ? "Você já tem uma solicitação para esse horário."
              : erro.message || "Erro ao enviar."
            : "Erro ao enviar.";
        setCelulas((prev) => {
          const { [chave]: _removido, ...resto } = prev;
          return resto;
        });
        setErrosCelula((prev) => ({ ...prev, [chave]: mensagem }));
      }
      return;
    }

    // Célula já enviada (pendente/aprovada): clicar de novo cancela.
    if (atual.estado === "enviada" && atual.solicitacaoId != null) {
      const solicitacaoId = atual.solicitacaoId;
      setCelulas((prev) => ({ ...prev, [chave]: { estado: "cancelando", carrinhoId, solicitacaoId } }));
      try {
        await apiFetch(`/api/solicitacoes/${solicitacaoId}/cancelar`, { method: "POST" });
        setCelulas((prev) => ({ ...prev, [chave]: { estado: "cancelada", carrinhoId } }));
      } catch (erro) {
        const mensagem =
          erro instanceof ApiError ? erro.message || "Erro ao cancelar." : "Erro ao cancelar.";
        setCelulas((prev) => ({ ...prev, [chave]: { estado: "enviada", carrinhoId, solicitacaoId } }));
        setErrosCelula((prev) => ({ ...prev, [chave]: mensagem }));
      }
      return;
    }

    // "enviando", "cancelando", "cancelada" e "rejeitada" não reagem a clique — o botão
    // já fica desabilitado nesses estados.
  }

  const enviadosEmOutrosCarrinhos = Object.values(celulas).filter(
    (info) => info.estado === "enviada" && info.carrinhoId !== carrinhoId,
  ).length;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <h1>Nova solicitação</h1>
        {janela?.mesAlvo && (
          <p className="text-muted-foreground">
            Escala de {formatarMes(janela.mesAlvo)}. Cada dia escolhido vale para todas as
            semanas do mês. Toque num horário para enviar e toque de novo para cancelar.
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
              {nomeVazio ? (
                <Alert variant="warning">
                  <AlertDescription>Preencha seu nome acima para escolher horários.</AlertDescription>
                </Alert>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Toque nos horários em que você quer trabalhar em {carrinhoSelecionado?.nome}.
                </p>
              )}
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
                            const chave = carrinhoId != null ? chaveDe(carrinhoId, d.valor, turno.id) : "";
                            const info = celulas[chave];
                            const estado = info?.estado;
                            const emAndamento = estado === "enviando" || estado === "cancelando";
                            const marcado = estado === "enviada";
                            const travada = estado === "cancelada" || estado === "rejeitada";
                            // Cancelar uma solicitação já enviada não depende do nome preenchido
                            // (regra 8: cancelamento é livre); só enviar uma nova exige o nome.
                            const podeCancelar = marcado && !emAndamento;
                            const podeEnviar = !marcado && !travada && disponivel && !nomeVazio && !emAndamento;
                            const desabilitado = !podeCancelar && !podeEnviar;

                            let conteudo = "";
                            if (marcado) conteudo = "✓";
                            else if (estado === "cancelada") conteudo = "–";
                            else if (estado === "rejeitada") conteudo = "✕";

                            let rotulo = `${d.label}, ${formatarTurno(turno.id)}`;
                            if (estado === "enviando") rotulo += ", enviando…";
                            else if (estado === "cancelando") rotulo += ", cancelando…";
                            else if (estado === "enviada") rotulo += ", enviada — toque para cancelar";
                            else if (estado === "cancelada") rotulo += ", cancelada";
                            else if (estado === "rejeitada") rotulo += ", rejeitada";

                            return (
                              <td key={d.valor} className="p-0">
                                <button
                                  type="button"
                                  aria-pressed={marcado}
                                  aria-label={rotulo}
                                  disabled={desabilitado}
                                  onClick={() => handleClicarCelula(d.valor, turno.id)}
                                  className={cn(
                                    "min-h-12 w-full min-w-11 rounded-lg border border-border text-xl leading-none transition-colors",
                                    disponivel
                                      ? "bg-muted/40 hover:bg-muted"
                                      : "cursor-not-allowed border-transparent bg-[repeating-linear-gradient(135deg,var(--color-background),var(--color-background)_5px,var(--color-muted)_5px,var(--color-muted)_10px)]",
                                    marcado &&
                                      "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
                                    estado === "enviando" && "opacity-60",
                                    estado === "cancelando" && "border-primary/60 bg-primary/60 text-primary-foreground",
                                    estado === "cancelada" && "cursor-not-allowed border-transparent text-muted-foreground",
                                    estado === "rejeitada" &&
                                      "cursor-not-allowed border-transparent bg-destructive-muted text-destructive",
                                  )}
                                >
                                  {conteudo}
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
              {carregandoSolicitacoes && (
                <p className="text-[0.8rem] text-muted-foreground">Carregando seus pedidos…</p>
              )}
              {enviadosEmOutrosCarrinhos > 0 && (
                <p className="text-[0.8rem] text-muted-foreground">
                  Você também tem {enviadosEmOutrosCarrinhos} horário(s) enviados em outros carrinhos.
                </p>
              )}
            </>
          )}
        </Card>
      )}

      {Object.keys(errosCelula).length > 0 && (
        <ul className="flex list-none flex-col gap-2 p-0">
          {Object.entries(errosCelula).map(([chave, mensagem]) => {
            const [carrinhoDaChave, diaDaChave, turnoDaChave] = chave.split("-").map(Number);
            return (
              <li key={chave}>
                <Alert variant="destructive">
                  <AlertDescription>
                    <strong>{nomeCarrinho(carrinhoDaChave)}</strong>, {formatarDia(diaDaChave as DiaSemana)},{" "}
                    {formatarTurno(turnoDaChave)}: {mensagem}
                  </AlertDescription>
                </Alert>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-sm text-muted-foreground">
        Acompanhe tudo em <Link to="/historico">Meu histórico</Link>.
      </p>
    </section>
  );
}
