import { HandHeartIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  descreverCelula,
  estadoCom,
  estadoVaga,
  precisaAtencao,
  ROTULO_ESTADO,
  type CelulaGrade,
  type EstadoVaga,
  type PedidoGrade,
} from "./gradeEscala";

export type ModoGestao = "nenhum" | "acoes" | "destino";

interface Props {
  /** undefined = esse carrinho não tem esse turno nesse dia. */
  celula: CelulaGrade | undefined;
  modo: ModoGestao;
  selecionadoId: number | null;
  /** O pedido que está sendo movido (modo destino). */
  movendo: PedidoGrade | null;
  /** A célula de onde o pedido selecionado está saindo (modo destino). */
  ehOrigem: boolean;
  onTocarPedido: (solicitacaoId: number) => void;
  onEscolherDestino: (celula: CelulaGrade) => void;
  onAdicionar: (celula: CelulaGrade) => void;
}

/** Ícone de quem é criança ou idoso (pode ser a 3ª pessoa da vaga — regra 1). */
function MarcaCriancaOuIdoso() {
  return (
    <>
      {" "}
      <HandHeartIcon aria-hidden className="inline size-4 shrink-0 align-[-0.15em]" />
      <span className="sr-only">(criança ou idoso)</span>
    </>
  );
}

function Nome({ pedido }: { pedido: PedidoGrade }) {
  return (
    <span className="leading-tight">
      {pedido.publicadorNome}
      {pedido.criancaOuIdoso && <MarcaCriancaOuIdoso />}
    </span>
  );
}

const DEPOIS_DE_MOVER: Record<EstadoVaga, string> = {
  vazia: "fica vazia",
  incompleta: "fica com 1 pessoa",
  completa: "fica completa",
  excesso: "fica com excesso",
};

/**
 * Uma vaga (carrinho, dia, turno) da tela de gestão, feita para toque: cada pessoa é um chip
 * grande; tocar seleciona. O estado da vaga (regra 1) não é escrito — a cor fica na célula
 * da tabela/lista (EscalaFinal) e aqui só vai o texto para leitor de tela. No modo destino a
 * célula inteira vira um botão ("toque na vaga para onde a pessoa vai"), com a cor de como a
 * vaga ficaria com a pessoa — qualquer vaga configurada continua tocável, porque o limite é
 * só sinalização (regra 3). Vagas não configuradas ficam inertes.
 */
export function CelulaEscala({
  celula,
  modo,
  selecionadoId,
  movendo,
  ehOrigem,
  onTocarPedido,
  onEscolherDestino,
  onAdicionar,
}: Props) {
  if (!celula) {
    return (
      <span className="text-border-strong" aria-label="Sem vaga">
        —
      </span>
    );
  }

  if (modo === "destino" && movendo) {
    if (ehOrigem) {
      return (
        <div className="flex min-h-11 flex-col justify-center gap-0.5 rounded-md bg-primary/10 p-2 ring-2 ring-primary">
          {celula.publicadores.map((p) => (
            <Nome key={p.solicitacaoId} pedido={p} />
          ))}
          <span className="text-[0.8rem] font-semibold text-primary">sai daqui</span>
        </div>
      );
    }

    if (!celula.disponivel) {
      return (
        <div className="flex min-h-11 flex-col justify-center gap-0.5 p-2 opacity-50">
          {celula.publicadores.map((p) => (
            <Nome key={p.solicitacaoId} pedido={p} />
          ))}
        </div>
      );
    }

    const depois = estadoCom(celula, movendo);
    return (
      <button
        type="button"
        onClick={() => onEscolherDestino(celula)}
        aria-label={`Mover para ${descreverCelula(celula)} (${DEPOIS_DE_MOVER[depois]})`}
        className={cn(
          "flex min-h-11 w-full cursor-pointer flex-col items-start justify-center gap-0.5 rounded-md border-2 border-dashed p-2 text-left transition-colors focus-visible:ring-[3px] focus-visible:ring-primary/50 outline-none",
          precisaAtencao(depois)
            ? "border-destructive bg-destructive-muted hover:bg-destructive-muted/70"
            : "border-success bg-success-muted hover:bg-success-muted/70",
        )}
      >
        {celula.publicadores.map((p) => (
          <Nome key={p.solicitacaoId} pedido={p} />
        ))}
      </button>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      {celula.publicadores.map((p) => {
        const selecionado = p.solicitacaoId === selecionadoId;
        return (
          <button
            key={p.solicitacaoId}
            type="button"
            aria-pressed={selecionado}
            onClick={() => onTocarPedido(p.solicitacaoId)}
            className={cn(
              "min-h-11 max-w-full cursor-pointer truncate rounded-full border border-border-strong bg-card px-3.5 text-left font-semibold transition-colors outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-primary/50",
              selecionado && "border-primary bg-primary text-primary-foreground hover:bg-primary-hover",
            )}
          >
            {p.publicadorNome}
            {p.criancaOuIdoso && <MarcaCriancaOuIdoso />}
          </button>
        );
      })}
      <span className="sr-only">{ROTULO_ESTADO[estadoVaga(celula)]}</span>
      {celula.disponivel && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-primary"
          aria-label={`Adicionar pessoa em ${descreverCelula(celula)}`}
          onClick={() => onAdicionar(celula)}
        >
          <PlusIcon aria-hidden />
        </Button>
      )}
    </div>
  );
}
