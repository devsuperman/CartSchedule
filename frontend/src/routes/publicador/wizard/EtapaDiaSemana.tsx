import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DIAS_SEMANA, type DiaSemana } from "../../../constants/diasSemana";

interface EtapaDiaSemanaProps {
  valor: DiaSemana | null;
  /** Dias em que o carrinho escolhido na etapa anterior tem turno. `null` enquanto os carrinhos carregam (ou se a
   * carga falhou) — aí todos os dias aparecem e o backend valida no envio. */
  diasDisponiveis: ReadonlySet<DiaSemana> | null;
  onSelecionar: (dia: DiaSemana) => void;
}

/** Etapa 3 do wizard: dia da semana. A escolha é recorrente — vale para todas as semanas
 * do mês, nunca uma data específica — e restrita a Segunda–Sexta (PLANNING.md regra 1).
 * Dias sem turno no carrinho escolhido nem aparecem (PLANNING.md regra 17). */
export function EtapaDiaSemana({ valor, diasDisponiveis, onSelecionar }: EtapaDiaSemanaProps) {
  return (
    <div className="flex flex-col gap-3" role="radiogroup" aria-label="Dia da semana">
      {DIAS_SEMANA.filter((d) => diasDisponiveis == null || diasDisponiveis.has(d.valor)).map((d) => (
          <Button
            key={d.valor}
            type="button"
            variant="outline"
            size="lg"
            role="radio"
            aria-checked={valor === d.valor}
            className={cn(
              "w-full justify-start text-left text-base",
              valor === d.valor &&
                "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
            )}
            onClick={() => onSelecionar(d.valor)}
          >
            {d.label}
          </Button>
      ))}
    </div>
  );
}
