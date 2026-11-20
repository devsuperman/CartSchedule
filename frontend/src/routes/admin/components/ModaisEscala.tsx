import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { apiFetch, ApiError } from "../../../api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
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
import { combinaComBusca, normalizar, type Publicador } from "./publicadores";
import {
  descreverCelula,
  estadoCom,
  estadoSem,
  vagaNoMesmoHorario,
  type CelulaGrade,
  type PedidoGrade,
} from "./gradeEscala";

function mensagemErro(erro: unknown, duplicado: string, fallback: string): string {
  if (erro instanceof ApiError && erro.status === 409) return duplicado;
  return erro instanceof ApiError ? erro.message : fallback;
}

function Aviso({ children }: { children: ReactNode }) {
  return (
    <Alert className="border-warning bg-warning-muted text-foreground">
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

/** Aviso (nunca bloqueio — regra 3) quando a vaga passaria da meta da regra 1. */
function AvisoExcesso({ destino, nome, criancaOuIdoso }: { destino: CelulaGrade; nome: string; criancaOuIdoso: boolean }) {
  if (estadoCom(destino, { criancaOuIdoso }) !== "excesso") return null;
  const n = destino.publicadores.length;
  return (
    <Aviso>
      Essa vaga já tem {n} {n === 1 ? "pessoa" : "pessoas"}. Com {nome}, ficará com excesso.
    </Aviso>
  );
}

/** Aviso quando quem sai deixa a vaga de origem com uma pessoa só. */
function AvisoOrigem({ origem, pedido }: { origem: CelulaGrade; pedido: PedidoGrade }) {
  if (estadoSem(origem, pedido.solicitacaoId) !== "incompleta") return null;
  const fica = origem.publicadores.find((p) => p.solicitacaoId !== pedido.solicitacaoId)!;
  return (
    <Aviso>
      {descreverCelula(origem)} ficará só com {fica.publicadorNome}.
    </Aviso>
  );
}

/** Aviso (nunca bloqueio — regra 10) quando a pessoa já está em outro carrinho nesse horário. */
function AvisoHorario({ nome, outra }: { nome: string; outra: CelulaGrade | null }) {
  if (!outra) return null;
  return (
    <Aviso>
      {nome} já está em {descreverCelula(outra)}, no mesmo horário.
    </Aviso>
  );
}

export interface Movimento {
  pedido: PedidoGrade;
  origem: CelulaGrade;
  destino: CelulaGrade;
}

/** Confirma a mudança de vaga: PATCH /api/admin/solicitacoes/{id}. */
export function ModalMover({
  movimento,
  celulas,
  onFechar,
  onMovido,
}: {
  movimento: Movimento | null;
  celulas: readonly CelulaGrade[];
  onFechar: () => void;
  onMovido: (movimento: Movimento) => void;
}) {
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function mover(m: Movimento) {
    setSalvando(true);
    setErro(null);
    try {
      await apiFetch(`/api/admin/solicitacoes/${m.pedido.solicitacaoId}`, {
        method: "PATCH",
        body: JSON.stringify({
          carrinhoId: m.destino.carrinhoId,
          diaSemana: m.destino.diaSemana,
          turnoId: m.destino.turnoId,
        }),
      });
      onMovido(m);
    } catch (e) {
      setErro(mensagemErro(e, `${m.pedido.publicadorNome} já tem um pedido nessa vaga.`, "Não foi possível mover."));
    } finally {
      setSalvando(false);
    }
  }

  function fechar() {
    if (salvando) return;
    setErro(null);
    onFechar();
  }

  return (
    <Dialog open={movimento !== null} onOpenChange={(aberto) => !aberto && fechar()}>
      <DialogContent>
        {movimento && (
          <>
            <DialogHeader>
              <DialogTitle>Mover {movimento.pedido.publicadorNome}?</DialogTitle>
              <DialogDescription>
                De {descreverCelula(movimento.origem)} para {descreverCelula(movimento.destino)}.
              </DialogDescription>
            </DialogHeader>
            <AvisoExcesso
              destino={movimento.destino}
              nome={movimento.pedido.publicadorNome}
              criancaOuIdoso={movimento.pedido.criancaOuIdoso}
            />
            <AvisoOrigem origem={movimento.origem} pedido={movimento.pedido} />
            <AvisoHorario
              nome={movimento.pedido.publicadorNome}
              outra={vagaNoMesmoHorario(
                celulas,
                movimento.destino,
                (p) => p.publicadorId === movimento.pedido.publicadorId,
                movimento.pedido.solicitacaoId,
              )}
            />
            {erro && (
              <Alert variant="destructive">
                <AlertDescription>{erro}</AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={salvando}>
                  Voltar
                </Button>
              </DialogClose>
              <Button type="button" disabled={salvando} onClick={() => mover(movimento)}>
                {salvando ? "Movendo…" : "Mover"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export interface Exclusao {
  pedido: PedidoGrade;
  celula: CelulaGrade;
}

/** Último recurso: DELETE /api/admin/solicitacoes/{id}, definitivo. */
export function ModalExcluir({
  exclusao,
  onFechar,
  onExcluido,
}: {
  exclusao: Exclusao | null;
  onFechar: () => void;
  onExcluido: (exclusao: Exclusao) => void;
}) {
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function excluir(ex: Exclusao) {
    setExcluindo(true);
    setErro(null);
    try {
      await apiFetch(`/api/admin/solicitacoes/${ex.pedido.solicitacaoId}`, { method: "DELETE" });
      onExcluido(ex);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Falha ao excluir.");
    } finally {
      setExcluindo(false);
    }
  }

  function fechar() {
    if (excluindo) return;
    setErro(null);
    onFechar();
  }

  return (
    <Dialog open={exclusao !== null} onOpenChange={(aberto) => !aberto && fechar()}>
      <DialogContent>
        {exclusao && (
          <>
            <DialogHeader>
              <DialogTitle>Excluir pedido?</DialogTitle>
              <DialogDescription>
                {exclusao.pedido.publicadorNome} — {descreverCelula(exclusao.celula)}. Isso não pode ser
                desfeito. Para trocar de vaga, use Mover.
              </DialogDescription>
            </DialogHeader>
            {erro && (
              <Alert variant="destructive">
                <AlertDescription>{erro}</AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={excluindo}>
                  Voltar
                </Button>
              </DialogClose>
              <Button
                type="button"
                variant="destructive"
                disabled={excluindo}
                onClick={() => excluir(exclusao)}
              >
                {excluindo ? "Excluindo…" : "Excluir"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Resposta de POST /api/admin/escalas/{mes}/solicitacoes. */
interface SolicitacaoCriada {
  id: number;
  publicadorId: string;
  publicadorNome: string;
  origem: number;
  criancaOuIdoso: boolean;
}

/**
 * Adição manual numa vaga (regra 9): POST /api/admin/escalas/{mes}/solicitacoes com um
 * publicador existente, escolhido pela busca (nome ou usuário, sem maiúsculas nem
 * acentos). Nome livre não cria ninguém, e a Escala não cria contas: quem não tem conta é
 * cadastrado na tela Publicadores. Quem já está na vaga aparece desabilitado; excesso e outro
 * carrinho no mesmo horário só avisam.
 */
export function ModalAdicionar({
  mes,
  celula,
  celulas,
  onFechar,
  onAdicionado,
}: {
  mes: string;
  celula: CelulaGrade | null;
  celulas: readonly CelulaGrade[];
  onFechar: () => void;
  onAdicionado: (celula: CelulaGrade, criada: SolicitacaoCriada) => void;
}) {
  return (
    <Dialog open={celula !== null} onOpenChange={(aberto) => !aberto && onFechar()}>
      <DialogContent>
        {celula && (
          <FormularioAdicionar
            key={`${celula.carrinhoId}-${celula.diaSemana}-${celula.turnoId}`}
            mes={mes}
            celula={celula}
            celulas={celulas}
            onAdicionado={onAdicionado}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function FormularioAdicionar({
  mes,
  celula,
  celulas,
  onAdicionado,
}: {
  mes: string;
  celula: CelulaGrade;
  celulas: readonly CelulaGrade[];
  onAdicionado: (celula: CelulaGrade, criada: SolicitacaoCriada) => void;
}) {
  const [publicadores, setPublicadores] = useState<Publicador[] | null>(null);
  const [busca, setBusca] = useState("");
  const [escolhido, setEscolhido] = useState<Publicador | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let atual = true;
    apiFetch<Publicador[]>("/api/admin/publicadores")
      .then((lista) => atual && setPublicadores(lista))
      .catch((e) => atual && setErro(e instanceof ApiError ? e.message : "Não foi possível carregar os publicadores."));
    return () => {
      atual = false;
    };
  }, []);

  const naVaga = new Set(celula.publicadores.map((p) => p.publicadorId));
  const termo = normalizar(busca);
  const visiveis = (publicadores ?? []).filter((p) => combinaComBusca(p, termo));

  async function adicionar(evento: FormEvent) {
    evento.preventDefault();
    if (!escolhido) return;
    setSalvando(true);
    setErro(null);
    try {
      const criada = await apiFetch<SolicitacaoCriada>(`/api/admin/escalas/${mes}/solicitacoes`, {
        method: "POST",
        body: JSON.stringify({
          publicadorId: escolhido.id,
          carrinhoId: celula.carrinhoId,
          diaSemana: celula.diaSemana,
          turnoId: celula.turnoId,
        }),
      });
      onAdicionado(celula, criada);
    } catch (e) {
      setErro(mensagemErro(e, "Essa pessoa já está nessa vaga.", "Não foi possível adicionar."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={adicionar}>
      <DialogHeader>
        <DialogTitle>Adicionar pessoa</DialogTitle>
        <DialogDescription>{descreverCelula(celula)}.</DialogDescription>
      </DialogHeader>
      <Input
        type="search"
        aria-label="Buscar publicador"
        placeholder="Nome ou usuário"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        autoComplete="off"
        autoFocus
      />
      {publicadores === null && !erro && <p className="text-muted-foreground">Carregando…</p>}
      {publicadores !== null && visiveis.length === 0 && (
        <p className="text-muted-foreground">
          Ninguém encontrado. Quem ainda não tem conta é cadastrado em{" "}
          <Link to="/admin/publicadores">Publicadores</Link>.
        </p>
      )}
      {visiveis.length > 0 && (
        <ul className="grid max-h-64 gap-1 overflow-y-auto" aria-label="Publicadores">
          {visiveis.map((p) => {
            const jaNaVaga = naVaga.has(p.id);
            const selecionado = escolhido?.id === p.id;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={jaNaVaga}
                  aria-pressed={selecionado}
                  onClick={() => setEscolhido(p)}
                  className={cn(
                    "flex min-h-11 w-full flex-col items-start rounded-md border px-3 py-1.5 text-left disabled:opacity-60",
                    selecionado ? "border-primary bg-primary/10" : "border-border",
                  )}
                >
                  <span className="font-medium">{p.nome}</span>
                  <span className="text-[0.9rem] text-muted-foreground">
                    {jaNaVaga ? "Já está nessa vaga" : (p.usuario ?? "Sem usuário")}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {escolhido && (
        <>
          <AvisoExcesso destino={celula} nome={escolhido.nome} criancaOuIdoso={escolhido.criancaOuIdoso} />
          <AvisoHorario
            nome={escolhido.nome}
            outra={vagaNoMesmoHorario(celulas, celula, (p) => p.publicadorId === escolhido.id)}
          />
        </>
      )}
      {erro && (
        <Alert variant="destructive">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" disabled={salvando}>
            Voltar
          </Button>
        </DialogClose>
        <Button type="submit" disabled={!escolhido || salvando}>
          {salvando ? "Adicionando…" : "Adicionar"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/**
 * Confirma fechar ou reabrir o envio de pedidos dos publicadores para a escala em envio:
 * PUT /api/admin/escalas/{mes}/envio. A abertura é automática no dia 15; fechar é só aqui.
 */
export function ModalEnvio({
  mes,
  abrir,
  onFechar,
  onAlterado,
}: {
  mes: string;
  /** null = modal fechado; true = reabrir o envio; false = fechar o envio. */
  abrir: boolean | null;
  onFechar: () => void;
  onAlterado: (aberto: boolean) => void;
}) {
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function alterar(aberto: boolean) {
    setSalvando(true);
    setErro(null);
    try {
      await apiFetch(`/api/admin/escalas/${mes}/envio`, { method: "PUT", body: JSON.stringify({ aberto }) });
      onAlterado(aberto);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível alterar o envio.");
    } finally {
      setSalvando(false);
    }
  }

  function fechar() {
    if (salvando) return;
    setErro(null);
    onFechar();
  }

  return (
    <Dialog open={abrir !== null} onOpenChange={(aberto) => !aberto && fechar()}>
      <DialogContent>
        {abrir !== null && (
          <>
            <DialogHeader>
              <DialogTitle>{abrir ? "Reabrir o envio?" : "Fechar o envio?"}</DialogTitle>
              <DialogDescription>
                {abrir
                  ? "Os publicadores voltam a poder enviar e excluir pedidos para esta escala."
                  : "Os publicadores não poderão mais enviar nem excluir pedidos para esta escala. Você pode reabrir depois."}
              </DialogDescription>
            </DialogHeader>
            {erro && (
              <Alert variant="destructive">
                <AlertDescription>{erro}</AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={salvando}>
                  Voltar
                </Button>
              </DialogClose>
              <Button type="button" disabled={salvando} onClick={() => alterar(abrir)}>
                {salvando ? "Salvando…" : abrir ? "Reabrir envio" : "Fechar envio"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
