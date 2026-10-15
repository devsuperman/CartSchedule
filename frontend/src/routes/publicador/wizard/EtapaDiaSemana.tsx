import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { DIAS_SEMANA, type DiaSemana } from "../../../constants/diasSemana";

/** Um dia oferecido; `livre` = algum carrinho tem vaga que o publicador ainda pode pedir. */
export interface OpcaoDia {
  dia: (typeof DIAS_SEMANA)[number];
  livre: boolean;
}

interface EtapaDiaSemanaProps {
  dias: readonly OpcaoDia[];
  carregando: boolean;
  erro: string | null;
  valor: DiaSemana | null;
  onSelecionar: (dia: DiaSemana) => void;
}

/** Etapa 1 do wizard: dia da semana. A escolha é recorrente — vale para todas as semanas
 * do mês, nunca uma data específica — e restrita a Segunda–Sexta (PLANNING.md regra 1).
 * Dias sem turno em nenhum carrinho nem aparecem (PLANNING.md regra 17); dias sem vaga
 * que o publicador possa pedir ficam desabilitados, sem texto. */
export function EtapaDiaSemana({ dias, carregando, erro, valor, onSelecionar }: EtapaDiaSemanaProps) {
  if (carregando) {
    return <p className="text-muted-foreground">Carregando dias disponíveis…</p>;
  }

  if (erro) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{erro}</AlertDescription>
      </Alert>
    );
  }

  if (dias.length === 0) {
    return (
      <Alert variant="warning">
        <AlertDescription>Nenhum carrinho disponível no momento.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-3" role="radiogroup" aria-label="Dia da semana">
      {dias.map(({ dia, livre }) => (
        <Button
          key={dia.valor}
          type="button"
          variant="outline"
          size="lg"
          role="radio"
          aria-checked={valor === dia.valor}
          disabled={!livre}
          className={cn(
            "w-full justify-start text-left text-base",
            valor === dia.valor && "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
          )}
          onClick={() => onSelecionar(dia.valor)}
        >
          {dia.label}
        </Button>
      ))}
    </div>
  );
}
