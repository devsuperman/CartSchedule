import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type { Turno } from "../../../constants/turnos";

interface EtapaTurnoProps {
  turnos: readonly Turno[];
  carrinhoNome?: string;
  valor: number | null;
  onSelecionar: (id: number) => void;
}

/** Etapa 4 (última) do wizard: turno, já filtrado pelos turnos habilitados no carrinho
 * escolhido na etapa anterior. Turnos são fixos no sistema, nunca cadastráveis pelo
 * admin (PLANNING.md regra 2). */
export function EtapaTurno({ turnos, carrinhoNome, valor, onSelecionar }: EtapaTurnoProps) {
  if (turnos.length === 0) {
    return (
      <Alert variant="warning">
        <AlertDescription>
          {carrinhoNome ? `${carrinhoNome} não tem` : "Este carrinho não tem"} turnos disponíveis. Toque em
          "Voltar" e escolha outro carrinho.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-3" role="radiogroup" aria-label="Turno">
      {turnos.map((t) => (
        <Button
          key={t.id}
          type="button"
          variant="outline"
          size="lg"
          role="radio"
          aria-checked={valor === t.id}
          className={cn(
            "w-full justify-start text-left text-base tabular-nums",
            valor === t.id &&
              "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
          )}
          onClick={() => onSelecionar(t.id)}
        >
          {t.horaInicio}–{t.horaFim}
        </Button>
      ))}
    </div>
  );
}
