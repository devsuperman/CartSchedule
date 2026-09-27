import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { HandHeartIcon, XIcon } from "lucide-react";
import { apiFetch } from "../../api/client";
import { DIAS_SEMANA } from "../../constants/diasSemana";
import { TURNOS } from "../../constants/turnos";
import { useTelaLarga } from "../../hooks/useTelaLarga";
import { formatarMes, formatarTurno } from "../../utils/formatacao";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { CelulaEscala, type ModoGestao } from "./components/CelulaEscala";
import { ModalEditarNome, type PublicadorEmEdicao } from "./components/ModalEditarNome";
import { ModalAdicionar, ModalExcluir, ModalMover, type Exclusao, type Movimento } from "./components/ModaisEscala";
import {
  atualizarPessoa,
  chaveCelula,
  classeEstado,
  comPedido,
  descreverCelula,
  estadoVaga,
  localizarPedido,
  moverPedido,
  precisaAtencao,
  semPedido,
  type CelulaGrade,
  type EscalaGradeResponse,
} from "./components/gradeEscala";

interface CarrinhoGrade {
  carrinhoId: number;
  carrinhoNome: string;
  celulas: CelulaGrade[];
}

function agruparPorCarrinho(celulas: CelulaGrade[]): CarrinhoGrade[] {
  const carrinhos: CarrinhoGrade[] = [];
  for (const celula of celulas) {
    let carrinho = carrinhos.find((c) => c.carrinhoId === celula.carrinhoId);
    if (!carrinho) {
      carrinho = { carrinhoId: celula.carrinhoId, carrinhoNome: celula.carrinhoNome, celulas: [] };
      carrinhos.push(carrinho);
    }
    carrinho.celulas.push(celula);
  }
  return carrinhos;
}

function pedeAtencao(c: CelulaGrade): boolean {
  return precisaAtencao(estadoVaga(c));
}

/**
 * Gestão da escala do mês pelo administrador (F13-FE-01, F14-FE-02), pensada para celular e
 * tablet. Mostra todas as vagas configuradas, inclusive as vazias, coloridas pelo estado
 * (regra 1): verde completa, vermelho com 1 pessoa ou com excesso — sem texto na célula.
 * "Toque para selecionar, toque para colocar": tocar num nome abre a barra de ações no rodapé
 * — Mover (a ação mais comum), Editar pessoa e, discreto, Excluir (último recurso). O "+" de
 * cada vaga adiciona alguém manualmente. A meta é só sinalização: mover ou adicionar avisa,
 * mas nunca bloqueia (regra 3), e o sistema nunca sugere quem mover ou excluir (regra 13).
 */
export default function EscalaFinal() {
  const { mes } = useParams<{ mes: string }>();
  const telaLarga = useTelaLarga();
  const [celulas, setCelulas] = useState<CelulaGrade[] | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [selecionadoId, setSelecionadoId] = useState<number | null>(null);
  const [escolhendoDestino, setEscolhendoDestino] = useState(false);
  const [movimento, setMovimento] = useState<Movimento | null>(null);
  const [exclusao, setExclusao] = useState<Exclusao | null>(null);
  const [adicionando, setAdicionando] = useState<CelulaGrade | null>(null);
  const [editandoNome, setEditandoNome] = useState<PublicadorEmEdicao | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [diaPorCarrinho, setDiaPorCarrinho] = useState<Record<number, number>>({});

  useEffect(() => {
    if (!mes) {
      return;
    }

    let cancelado = false;
    setCarregando(true);
    setErro(null);

    apiFetch<EscalaGradeResponse>(`/api/admin/escalas/${mes}/grade`)
      .then((resposta) => {
        if (!cancelado) {
          setCelulas(resposta.celulas);
        }
      })
      .catch(() => {
        if (!cancelado) {
          setErro("Não foi possível carregar a escala. Tente novamente.");
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

  if (!mes) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Mês da escala não informado na URL.</AlertDescription>
      </Alert>
    );
  }

  if (carregando) {
    return <p className="text-muted-foreground">Carregando escala…</p>;
  }

  if (erro) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{erro}</AlertDescription>
      </Alert>
    );
  }

  const lista = celulas ?? [];

  if (lista.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <h1>Escala</h1>
        <Card className="items-center gap-2 py-10 text-center text-muted-foreground">
          <strong className="block text-[1.1rem] text-foreground">Nenhuma vaga em {formatarMes(mes)}</strong>
          <span>
            Configure os turnos dos carrinhos em <Link to="/admin/carrinhos">Carrinhos</Link>.
          </span>
        </Card>
      </div>
    );
  }

  const selecionado = selecionadoId !== null ? localizarPedido(lista, selecionadoId) : null;
  const modo: ModoGestao = !selecionado ? "nenhum" : escolhendoDestino ? "destino" : "acoes";
  const chaveOrigem = selecionado ? chaveCelula(selecionado.celula) : null;

  const carrinhos = agruparPorCarrinho(lista);
  const pedidos = lista.flatMap((c) => c.publicadores);
  const incompletas = lista.filter((c) => estadoVaga(c) === "incompleta").length;
  const excedentes = lista.filter((c) => estadoVaga(c) === "excesso").length;
  const nomesSugeridos = [...new Set(pedidos.map((p) => p.publicadorNome))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const nomesCriancaOuIdoso = [...new Set(pedidos.filter((p) => p.criancaOuIdoso).map((p) => p.publicadorNome))];

  function limparSelecao() {
    setSelecionadoId(null);
    setEscolhendoDestino(false);
  }

  function tocarPedido(solicitacaoId: number) {
    setAviso(null);
    setEscolhendoDestino(false);
    setSelecionadoId((atual) => (atual === solicitacaoId ? null : solicitacaoId));
  }

  function escolherDestino(destino: CelulaGrade) {
    if (!selecionado) return;
    setMovimento({ pedido: selecionado.pedido, origem: selecionado.celula, destino });
  }

  function celulaDe(carrinho: CarrinhoGrade, dia: number, turnoId: number) {
    return carrinho.celulas.find((c) => c.diaSemana === dia && c.turnoId === turnoId);
  }

  function renderCelula(celula: CelulaGrade | undefined) {
    return (
      <CelulaEscala
        celula={celula}
        modo={modo}
        selecionadoId={selecionadoId}
        movendo={modo === "destino" && selecionado ? selecionado.pedido : null}
        ehOrigem={celula !== undefined && chaveCelula(celula) === chaveOrigem}
        onTocarPedido={tocarPedido}
        onEscolherDestino={escolherDestino}
        onAdicionar={(c) => {
          setAviso(null);
          setAdicionando(c);
        }}
      />
    );
  }

  /** Cor do estado da vaga; ao escolher destino, quem colore é o botão de cada vaga. */
  function corDaVaga(celula: CelulaGrade | undefined) {
    return celula !== undefined && modo !== "destino" && classeEstado(estadoVaga(celula));
  }

  function renderTabela(carrinho: CarrinhoGrade) {
    const turnos = TURNOS.filter((t) => carrinho.celulas.some((c) => c.turnoId === t.id));
    return (
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table className="min-w-[42rem] table-fixed tabular-nums">
          <TableHeader>
            <TableRow>
              <TableHead className="w-24 border border-border">Turno</TableHead>
              {DIAS_SEMANA.map((dia) => (
                <TableHead key={dia.valor} className="border border-border">
                  {dia.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {turnos.map((turno) => (
              <TableRow key={turno.id}>
                <TableCell asChild>
                  <th scope="row" className="bg-muted/60 p-2 text-left align-top text-sm font-semibold">
                    {turno.horaInicio}–{turno.horaFim}
                  </th>
                </TableCell>
                {DIAS_SEMANA.map((dia) => {
                  const celula = celulaDe(carrinho, dia.valor, turno.id);
                  return (
                    <TableCell
                      key={dia.valor}
                      className={cn("p-1.5 align-top whitespace-normal", corDaVaga(celula))}
                    >
                      {renderCelula(celula)}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  function renderPorDia(carrinho: CarrinhoGrade) {
    const diasComVaga = DIAS_SEMANA.filter((d) => carrinho.celulas.some((c) => c.diaSemana === d.valor));
    const dia = diaPorCarrinho[carrinho.carrinhoId] ?? diasComVaga[0]?.valor;
    const turnos = TURNOS.filter((t) => celulaDe(carrinho, dia, t.id));

    return (
      <div className="flex flex-col gap-2">
        <div role="group" aria-label={`Dia da semana — ${carrinho.carrinhoNome}`} className="grid grid-cols-5 gap-1">
          {DIAS_SEMANA.map((d) => {
            const celulasDoDia = carrinho.celulas.filter((c) => c.diaSemana === d.valor);
            const atencao = celulasDoDia.filter(pedeAtencao).length;
            const ativo = d.valor === dia;
            return (
              <button
                key={d.valor}
                type="button"
                aria-pressed={ativo}
                aria-label={`${d.label}${
                  atencao > 0 ? `, ${atencao} ${atencao === 1 ? "vaga precisa" : "vagas precisam"} de atenção` : ""
                }`}
                disabled={celulasDoDia.length === 0}
                onClick={() => setDiaPorCarrinho((atual) => ({ ...atual, [carrinho.carrinhoId]: d.valor }))}
                className={cn(
                  "relative flex h-11 cursor-pointer items-center justify-center rounded-md border border-border-strong bg-card text-[0.95rem] font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-40",
                  ativo && "border-primary bg-primary text-primary-foreground",
                )}
              >
                {d.curto}
                {atencao > 0 && (
                  <span
                    aria-hidden
                    className="absolute top-1 right-1 size-2 rounded-full bg-destructive ring-1 ring-card"
                  />
                )}
              </button>
            );
          })}
        </div>
        <ul className="list-none overflow-hidden rounded-lg border border-border bg-card p-0">
          {turnos.map((turno) => {
            const celula = celulaDe(carrinho, dia, turno.id)!;
            return (
              <li
                key={turno.id}
                className={cn("flex gap-3 border-t border-border p-2.5 first:border-t-0", corDaVaga(celula))}
              >
                <span className="w-[6.5rem] shrink-0 pt-2.5 text-sm font-semibold tabular-nums">
                  {formatarTurno(turno.id)}
                </span>
                <div className="min-w-0 flex-1">{renderCelula(celula)}</div>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <h1>Escala</h1>
        <p className="text-muted-foreground">
          {formatarMes(mes)}. Toque num nome para mover a pessoa de vaga. Meta: 2 pessoas por vaga, ou 3 com
          uma criança ou idoso
          <HandHeartIcon aria-hidden className="mx-1 inline size-4 align-[-0.15em]" />.
        </p>
      </div>

      <dl className="grid grid-cols-3 gap-2 sm:gap-3">
        <Card className="gap-1 p-3">
          <dt className="text-sm text-muted-foreground">Pedidos</dt>
          <dd className="m-0 text-[1.5rem] font-bold tabular-nums">{pedidos.length}</dd>
        </Card>
        <Card className="gap-1 p-3">
          <dt className="text-sm text-muted-foreground">Vagas com 1 pessoa</dt>
          <dd className="m-0 text-[1.5rem] font-bold tabular-nums">{incompletas}</dd>
        </Card>
        <Card className="gap-1 p-3">
          <dt className="text-sm text-muted-foreground">Vagas com excesso</dt>
          <dd className="m-0 text-[1.5rem] font-bold tabular-nums">{excedentes}</dd>
        </Card>
      </dl>

      <p role="status" className={cn("text-[0.95rem] font-semibold text-success", !aviso && "sr-only")}>
        {aviso}
      </p>

      {carrinhos.map((carrinho) => (
        <section key={carrinho.carrinhoId} className="flex flex-col gap-2">
          <h2>{carrinho.carrinhoNome}</h2>
          {telaLarga ? renderTabela(carrinho) : renderPorDia(carrinho)}
        </section>
      ))}

      {selecionado && (
        <>
          {/* Espaço para a barra fixa não cobrir as últimas vagas. */}
          <div aria-hidden className="h-44" />
          <div
            role="region"
            aria-label="Ações do pedido selecionado"
            className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card shadow-[0_-4px_16px_rgb(0_0_0/0.08)]"
          >
            <div className="mx-auto flex max-w-4xl flex-col gap-3 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <strong className="block truncate text-[1.05rem]">
                    {selecionado.pedido.publicadorNome}
                    {selecionado.pedido.criancaOuIdoso && (
                      <span className="ml-2 text-sm font-normal text-muted-foreground">criança ou idoso</span>
                    )}
                  </strong>
                  <span className="block text-sm text-muted-foreground">
                    {modo === "destino"
                      ? `Toque na vaga para onde ${selecionado.pedido.publicadorNome} vai.`
                      : `${descreverCelula(selecionado.celula)} · ${selecionado.pedido.totalNaEscala} ${
                          selecionado.pedido.totalNaEscala === 1 ? "pedido" : "pedidos"
                        } nesta escala`}
                  </span>
                </div>
                <Button type="button" variant="ghost" size="icon" aria-label="Fechar" onClick={limparSelecao}>
                  <XIcon aria-hidden />
                </Button>
              </div>
              {modo === "acoes" && (
                // Esquerda: Editar pessoa e, embaixo, o Excluir discreto. Direita: Mover, a ação principal.
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-start gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      onClick={() =>
                        setEditandoNome({
                          id: selecionado.pedido.publicadorId,
                          nome: selecionado.pedido.publicadorNome,
                          criancaOuIdoso: selecionado.pedido.criancaOuIdoso,
                        })
                      }
                    >
                      Editar pessoa
                    </Button>
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto px-1 py-1 text-[0.85rem] font-normal text-destructive"
                      onClick={() => setExclusao({ pedido: selecionado.pedido, celula: selecionado.celula })}
                    >
                      Excluir pedido
                    </Button>
                  </div>
                  <Button type="button" size="lg" className="flex-1" onClick={() => setEscolhendoDestino(true)}>
                    Mover
                  </Button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <ModalMover
        movimento={movimento}
        onFechar={() => setMovimento(null)}
        onMovido={(m) => {
          setCelulas((atual) => (atual ? moverPedido(atual, m.pedido.solicitacaoId, chaveCelula(m.destino)) : atual));
          setMovimento(null);
          limparSelecao();
          setAviso(`${m.pedido.publicadorNome} agora está em ${descreverCelula(m.destino)}.`);
        }}
      />

      <ModalExcluir
        exclusao={exclusao}
        onFechar={() => setExclusao(null)}
        onExcluido={(ex) => {
          setCelulas((atual) => (atual ? semPedido(atual, ex.pedido.solicitacaoId) : atual));
          setExclusao(null);
          limparSelecao();
          setAviso(`Pedido de ${ex.pedido.publicadorNome} excluído.`);
        }}
      />

      <ModalAdicionar
        mes={mes}
        celula={adicionando}
        nomesSugeridos={nomesSugeridos}
        nomesCriancaOuIdoso={nomesCriancaOuIdoso}
        onFechar={() => setAdicionando(null)}
        onAdicionado={(celula, criada) => {
          setCelulas((atual) =>
            atual
              ? atualizarPessoa(
                  comPedido(atual, chaveCelula(celula), {
                    solicitacaoId: criada.id,
                    publicadorId: criada.publicadorId,
                    publicadorNome: criada.publicadorNome,
                    origem: criada.origem,
                    criancaOuIdoso: criada.criancaOuIdoso,
                  }),
                  criada.publicadorId,
                  { criancaOuIdoso: criada.criancaOuIdoso },
                )
              : atual,
          );
          setAdicionando(null);
          setAviso(`${criada.publicadorNome} adicionado em ${descreverCelula(celula)}.`);
        }}
      />

      <ModalEditarNome
        publicador={editandoNome}
        onFechar={() => setEditandoNome(null)}
        onSalvo={({ id, nome, criancaOuIdoso }) => {
          setCelulas((atual) => (atual ? atualizarPessoa(atual, id, { publicadorNome: nome, criancaOuIdoso }) : atual));
          setEditandoNome(null);
        }}
      />
    </div>
  );
}
