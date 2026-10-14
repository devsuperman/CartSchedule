import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type { Turno } from "../../../constants/turnos";

/** Um turno oferecido, com a lotação atual da vaga (carrinho, dia, turno) na escala-alvo. */
export interface VagaTurno {
  turno: Turno;
  ocupacao: number;
  /** Vaga cheia: o backend recusa novos pedidos de publicador (PLANNING.md regra 3). */
  cheia: boolean;
}

interface EtapaTurnoProps {
  vagas: readonly VagaTurno[];
  carrinhoNome?: string;
  valor: number | null;
  onSelecionar: (id: number) => void;
}

function rotuloOcupacao({ ocupacao, cheia }: VagaTurno): string {
  if (cheia) return "Cheio";
  if (ocupacao === 0) return "Vago";
  return ocupacao === 1 ? "1 pessoa nesta vaga" : `${ocupacao} pessoas nesta vaga`;
}

/** Etapa 3 (última) do wizard: turno, já filtrado pelos turnos habilitados no carrinho
 * escolhido, no dia da semana escolhido na etapa anterior (PLANNING.md regra 17), com a
 * ocupação de cada vaga para o publicador preferir as vazias. Vaga cheia fica desabilitada.
 * Turnos são fixos no sistema, nunca cadastráveis pelo admin (PLANNING.md regra 2). */
export function EtapaTurno({ vagas, carrinhoNome, valor, onSelecionar }: EtapaTurnoProps) {
  if (vagas.length === 0) {
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
      {vagas.map((v) => (
        <Button
          key={v.turno.id}
          type="button"
          variant="outline"
          size="lg"
          role="radio"
          aria-checked={valor === v.turno.id}
          disabled={v.cheia}
          className={cn(
            "w-full justify-between text-left text-base tabular-nums",
            valor === v.turno.id &&
              "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
          )}
          onClick={() => onSelecionar(v.turno.id)}
        >
          <span>
            {v.turno.horaInicio}–{v.turno.horaFim}
          </span>
          <span className="text-sm font-normal opacity-80">{rotuloOcupacao(v)}</span>
        </Button>
      ))}
    </div>
  );
}
