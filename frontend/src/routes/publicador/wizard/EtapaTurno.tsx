import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type { Turno } from "../../../constants/turnos";

export interface TurnoComOcupacao {
  turno: Turno;
  /** Pessoas que já pediram essa vaga (carrinho + dia + turno) na escala-alvo. */
  ocupacao: number;
  /** Vaga cheia: o backend recusa novos envios, então o botão fica desabilitado. */
  cheia: boolean;
}

interface EtapaTurnoProps {
  turnos: readonly TurnoComOcupacao[];
  carrinhoNome?: string;
  valor: number | null;
  onSelecionar: (id: number) => void;
}

function rotuloOcupacao({ ocupacao, cheia }: TurnoComOcupacao): string {
  if (cheia) return "Cheio";
  if (ocupacao === 0) return "Vago";
  return `${ocupacao} ${ocupacao === 1 ? "pessoa" : "pessoas"} nesta vaga`;
}

/** Etapa 4 (última) do wizard: turno, já filtrado pelos turnos habilitados no carrinho
 * escolhido, no dia da semana escolhido na etapa anterior (PLANNING.md regra 17). Cada turno
 * mostra quantas pessoas já pediram a vaga; vagas cheias ficam desabilitadas (PLANNING.md
 * regra 3). Turnos são fixos no sistema, nunca cadastráveis pelo admin (regra 2). */
export function EtapaTurno({ turnos, carrinhoNome, valor, onSelecionar }: EtapaTurnoProps) {
  if (turnos.length === 0) {
    return (
      <Alert variant="warning">
        <AlertDescription>
          {carrinhoNome ? `${carrinhoNome} não tem` : "Este carrinho não tem"} turnos disponíveis nesse
          dia. Toque em "Voltar" e escolha outro dia.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-3" role="radiogroup" aria-label="Turno">
      {turnos.map((vaga) => {
        const { turno: t } = vaga;
        const selecionado = valor === t.id;
        return (
          <Button
            key={t.id}
            type="button"
            variant="outline"
            size="lg"
            role="radio"
            aria-checked={selecionado}
            disabled={vaga.cheia}
            className={cn(
              "h-auto min-h-12 w-full flex-col items-start justify-center gap-0.5 py-3 text-left text-base tabular-nums",
              selecionado && "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
            )}
            onClick={() => onSelecionar(t.id)}
          >
            <span>
              {t.horaInicio}–{t.horaFim}
            </span>
            <span
              className={cn(
                "text-sm font-normal",
                selecionado ? "text-primary-foreground/90" : "text-muted-foreground",
              )}
            >
              {rotuloOcupacao(vaga)}
            </span>
          </Button>
        );
      })}
    </div>
  );
}
