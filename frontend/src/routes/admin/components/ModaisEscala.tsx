import { useState, type FormEvent, type ReactNode } from "react";
import { apiFetch, ApiError } from "../../../api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { CampoCriancaOuIdoso } from "./ModalEditarNome";
import { descreverCelula, estadoCom, estadoSem, type CelulaGrade, type PedidoGrade } from "./gradeEscala";

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

export interface Movimento {
  pedido: PedidoGrade;
  origem: CelulaGrade;
  destino: CelulaGrade;
}

/** Confirma a mudança de vaga: PATCH /api/admin/solicitacoes/{id}. */
export function ModalMover({
  movimento,
  onFechar,
  onMovido,
}: {
  movimento: Movimento | null;
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
 * Adição manual numa vaga (regra 9): POST /api/admin/escalas/{mes}/solicitacoes. Nome livre;
 * se bater exatamente com um existente, a API reaproveita o publicador — as sugestões ajudam
 * a digitar o nome igual. "Criança ou idoso" marcado vale para a pessoa (nova ou não); a API
 * nunca desmarca por aqui. `nomesCriancaOuIdoso` são os já marcados na escala, para o aviso de
 * excesso considerar a marca mesmo sem a caixa.
 */
export function ModalAdicionar({
  mes,
  celula,
  nomesSugeridos,
  nomesCriancaOuIdoso,
  onFechar,
  onAdicionado,
}: {
  mes: string;
  celula: CelulaGrade | null;
  nomesSugeridos: string[];
  nomesCriancaOuIdoso: string[];
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
            nomesSugeridos={nomesSugeridos}
            nomesCriancaOuIdoso={nomesCriancaOuIdoso}
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
  nomesSugeridos,
  nomesCriancaOuIdoso,
  onAdicionado,
}: {
  mes: string;
  celula: CelulaGrade;
  nomesSugeridos: string[];
  nomesCriancaOuIdoso: string[];
  onAdicionado: (celula: CelulaGrade, criada: SolicitacaoCriada) => void;
}) {
  const [nome, setNome] = useState("");
  const [criancaOuIdoso, setCriancaOuIdoso] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const valido = nome.trim() !== "";

  async function adicionar(evento: FormEvent) {
    evento.preventDefault();
    if (!valido) return;
    setSalvando(true);
    setErro(null);
    try {
      const criada = await apiFetch<SolicitacaoCriada>(`/api/admin/escalas/${mes}/solicitacoes`, {
        method: "POST",
        body: JSON.stringify({
          nome: nome.trim(),
          carrinhoId: celula.carrinhoId,
          diaSemana: celula.diaSemana,
          turnoId: celula.turnoId,
          criancaOuIdoso,
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
        aria-label="Nome do publicador"
        placeholder="Nome e sobrenome"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        list="nomes-na-escala"
        maxLength={200}
        autoComplete="off"
        autoFocus
        required
      />
      <datalist id="nomes-na-escala">
        {nomesSugeridos.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <CampoCriancaOuIdoso marcado={criancaOuIdoso} onMudar={setCriancaOuIdoso} />
      <AvisoExcesso
        destino={celula}
        nome={nome.trim() || "essa pessoa"}
        criancaOuIdoso={criancaOuIdoso || nomesCriancaOuIdoso.includes(nome.trim())}
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
        <Button type="submit" disabled={!valido || salvando}>
          {salvando ? "Adicionando…" : "Adicionar"}
        </Button>
      </DialogFooter>
    </form>
  );
}
