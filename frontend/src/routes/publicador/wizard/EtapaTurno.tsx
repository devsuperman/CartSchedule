import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type { Turno } from "../../../constants/turnos";

/** Um turno oferecido no dia escolhido; `livre` = algum carrinho tem vaga que o publicador
 * ainda pode pedir. */
export interface OpcaoTurno {
  turno: Turno;
  livre: boolean;
  /** O publicador já tem pedido nesse dia e horário, em qualquer carrinho (o turno fica desabilitado). */
  jaTemPedido: boolean;
}

interface EtapaTurnoProps {
  turnos: readonly OpcaoTurno[];
  valor: number | null;
  onSelecionar: (id: number) => void;
}

/** Etapa 2 do wizard: turno. Só aparecem os turnos que algum carrinho tem configurados no
 * dia escolhido (PLANNING.md regra 17); sem vaga que o publicador possa pedir, o turno fica
 * desabilitado — a ocupação de cada vaga aparece só na etapa do carrinho. Se ele já tem pedido
 * nesse horário (em qualquer carrinho), o turno fica desabilitado e avisa: não dá para estar
 * em dois lugares ao mesmo tempo (PLANNING.md regra 10).
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
      {turnos.map(({ turno, livre, jaTemPedido }) => (
        <Button
          key={turno.id}
          type="button"
          variant="outline"
          size="lg"
          role="radio"
          aria-checked={valor === turno.id}
          disabled={!livre}
          className={cn(
            // Altura automática + whitespace-normal: o aviso de pedido já feito pode quebrar linha.
            "h-auto min-h-12 w-full justify-between gap-3 whitespace-normal py-3 text-left text-base tabular-nums",
            valor === turno.id && "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
          )}
          onClick={() => onSelecionar(turno.id)}
        >
          <span>
            {turno.horaInicio}–{turno.horaFim}
          </span>
          {jaTemPedido && (
            <span className="text-right text-sm font-normal opacity-80">
              Você já tem pedido neste horário
            </span>
          )}
        </Button>
      ))}
    </div>
  );
}
