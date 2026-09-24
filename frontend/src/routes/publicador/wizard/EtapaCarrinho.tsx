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

/** Etapa 2 do wizard: carrinho. Só aparecem carrinhos ativos (filtro do backend em
 * GET /api/carrinhos) com algum turno configurado em qualquer dia da semana (filtro do
 * SolicitacaoWizard, PLANNING.md regra 17). */
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
        <AlertDescription>Nenhum carrinho disponível no momento.</AlertDescription>
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
            // Altura automática + whitespace-normal: a descrição pode quebrar linha em telas
            // estreitas (o botão padrão é de uma linha só, h-12 + whitespace-nowrap).
            "h-auto min-h-12 w-full flex-col items-start justify-center gap-0.5 whitespace-normal py-3 text-left text-base",
            valor === c.id &&
              "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
          )}
          onClick={() => onSelecionar(c.id)}
        >
          <span className="break-words">{c.nome}</span>
          {c.descricao?.trim() && (
            <span
              className={cn(
                "break-words text-sm font-normal",
                valor === c.id ? "text-primary-foreground/90" : "text-muted-foreground",
              )}
            >
              {c.descricao}
            </span>
          )}
        </Button>
      ))}
    </div>
  );
}
