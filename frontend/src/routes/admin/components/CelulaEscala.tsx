import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { descreverCelula, LIMITE_POR_VAGA, ocupacao, type CelulaGrade } from "./gradeEscala";

export type ModoGestao = "nenhum" | "acoes" | "destino";

interface Props {
  /** undefined = esse carrinho não tem esse turno nesse dia. */
  celula: CelulaGrade | undefined;
  modo: ModoGestao;
  selecionadoId: number | null;
  /** A célula de onde o pedido selecionado está saindo (modo destino). */
  ehOrigem: boolean;
  onTocarPedido: (solicitacaoId: number) => void;
  onEscolherDestino: (celula: CelulaGrade) => void;
  onAdicionar: (celula: CelulaGrade) => void;
}

function Ocupacao({ celula }: { celula: CelulaGrade }) {
  const n = celula.publicadores.length;
  return (
    <span
      className={cn(
        "text-[0.8rem] font-semibold text-muted-foreground",
        n > LIMITE_POR_VAGA && "font-bold text-destructive",
      )}
    >
      {ocupacao(celula)}
    </span>
  );
}

/**
 * Uma vaga (carrinho, dia, turno) da tela de gestão, feita para toque: cada pessoa é um chip
 * grande; tocar seleciona. No modo destino a célula inteira vira um botão ("toque na vaga
 * para onde a pessoa vai"), colorida pela ocupação — vaga cheia continua tocável, porque o
 * limite de 2 é só sinalização (regra 3). Vagas não configuradas ficam inertes.
 */
export function CelulaEscala({
  celula,
  modo,
  selecionadoId,
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

  const n = celula.publicadores.length;
  const nomes = celula.publicadores.map((p) => p.publicadorNome);

  if (modo === "destino") {
    if (ehOrigem) {
      return (
        <div className="flex min-h-11 flex-col justify-center gap-0.5 rounded-md bg-primary/10 p-2 ring-2 ring-primary">
          {nomes.map((nome, i) => (
            <span key={i} className="leading-tight">
              {nome}
            </span>
          ))}
          <span className="text-[0.8rem] font-semibold text-primary">sai daqui</span>
        </div>
      );
    }

    if (!celula.disponivel) {
      return (
        <div className="flex min-h-11 flex-col justify-center gap-0.5 p-2 opacity-50">
          {nomes.map((nome, i) => (
            <span key={i} className="leading-tight">
              {nome}
            </span>
          ))}
        </div>
      );
    }

    return (
      <button
        type="button"
        onClick={() => onEscolherDestino(celula)}
        aria-label={`Mover para ${descreverCelula(celula)} (${ocupacao(celula)})`}
        className={cn(
          "flex min-h-11 w-full cursor-pointer flex-col items-start justify-center gap-0.5 rounded-md border-2 border-dashed p-2 text-left transition-colors focus-visible:ring-[3px] focus-visible:ring-primary/50 outline-none",
          n < LIMITE_POR_VAGA
            ? "border-success bg-success-muted hover:bg-success-muted/70"
            : "border-warning bg-warning-muted hover:bg-warning-muted/70",
        )}
      >
        {nomes.map((nome, i) => (
          <span key={i} className="leading-tight">
            {nome}
          </span>
        ))}
        <Ocupacao celula={celula} />
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
          </button>
        );
      })}
      <div className="flex items-center gap-1">
        <Ocupacao celula={celula} />
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
    </div>
  );
}
