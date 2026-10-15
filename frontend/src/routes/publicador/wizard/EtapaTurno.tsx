import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type { Turno } from "../../../constants/turnos";

/** Um turno oferecido no dia escolhido; `livre` = algum carrinho tem vaga que o publicador
 * ainda pode pedir. */
export interface OpcaoTurno {
  turno: Turno;
  livre: boolean;
}

interface EtapaTurnoProps {
  turnos: readonly OpcaoTurno[];
  valor: number | null;
  onSelecionar: (id: number) => void;
}

/** Etapa 2 do wizard: turno. Só aparecem os turnos que algum carrinho tem configurados no
 * dia escolhido (PLANNING.md regra 17); sem vaga que o publicador possa pedir, o turno fica
 * desabilitado, sem texto — a ocupação de cada vaga aparece só na etapa do carrinho.
 * Turnos são fixos no sistema, nunca cadastráveis pelo admin (PLANNING.md regra 2). */
export function EtapaTurno({ turnos, valor, onSelecionar }: EtapaTurnoProps) {
  if (turnos.length === 0) {
    return (
      <Alert variant="warning">
        <AlertDescription>Nenhum carrinho tem turnos nesse dia. Toque em "Voltar" e escolha outro dia.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-3" role="radiogroup" aria-label="Turno">
      {turnos.map(({ turno, livre }) => (
        <Button
          key={turno.id}
          type="button"
          variant="outline"
          size="lg"
          role="radio"
          aria-checked={valor === turno.id}
          disabled={!livre}
          className={cn(
            "w-full justify-start text-left text-base tabular-nums",
            valor === turno.id && "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
          )}
          onClick={() => onSelecionar(turno.id)}
        >
          {turno.horaInicio}–{turno.horaFim}
        </Button>
      ))}
    </div>
  );
}
