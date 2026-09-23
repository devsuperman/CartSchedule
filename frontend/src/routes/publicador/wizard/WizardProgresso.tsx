interface WizardProgressoProps {
  etapa: number;
  total: number;
}

/** Indicador de progresso do wizard ("Passo X de Y"), puramente visual e não interativo —
 * por isso é uma div simples em vez de instalar o componente Progress do shadcn/Radix. */
export function WizardProgresso({ etapa, total }: WizardProgressoProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-sm font-semibold text-muted-foreground">
        Passo {etapa} de {total}
      </p>
      <div
        role="progressbar"
        aria-valuenow={etapa}
        aria-valuemin={1}
        aria-valuemax={total}
        className="h-1.5 w-full rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${(etapa / total) * 100}%` }}
        />
      </div>
    </div>
  );
}
