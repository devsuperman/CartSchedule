import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type { Carrinho } from "./SolicitacaoWizard";

interface EtapaCarrinhoProps {
  carrinhos: Carrinho[];
  carregando: boolean;
  erro: string | null;
  valor: number | null;
  onSelecionar: (id: number) => void;
}

/** Etapa 3 do wizard: carrinho. A lista já vem só com carrinhos ativos (filtro do
 * backend em GET /api/carrinhos). */
export function EtapaCarrinho({ carrinhos, carregando, erro, valor, onSelecionar }: EtapaCarrinhoProps) {
  if (carregando) {
    return <p className="text-muted-foreground">Carregando carrinhos…</p>;
  }

  if (erro) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{erro}</AlertDescription>
      </Alert>
    );
  }

  if (carrinhos.length === 0) {
    return (
      <Alert variant="warning">
        <AlertDescription>Nenhum carrinho disponível no momento. Volte mais tarde.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-3" role="radiogroup" aria-label="Carrinho">
      {carrinhos.map((c) => (
        <Button
          key={c.id}
          type="button"
          variant="outline"
          size="lg"
          role="radio"
          aria-checked={valor === c.id}
          className={cn(
            "w-full justify-start text-left text-base",
            valor === c.id &&
              "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
          )}
          onClick={() => onSelecionar(c.id)}
        >
          {c.nome}
        </Button>
      ))}
    </div>
  );
}
