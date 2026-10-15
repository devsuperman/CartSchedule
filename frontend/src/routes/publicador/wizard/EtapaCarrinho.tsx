import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type { Carrinho } from "./SolicitacaoWizard";

/** Um carrinho com o (dia, turno) escolhido configurado, com a lotação atual dessa vaga na
 * escala-alvo. */
export interface VagaCarrinho {
  carrinho: Carrinho;
  ocupacao: number;
  /** Vaga cheia: o backend recusa novos pedidos de publicador (PLANNING.md regra 3). */
  cheia: boolean;
  /** O publicador já pediu essa vaga — pedir de novo seria duplicidade (PLANNING.md regra 4). */
  jaPedida: boolean;
}

interface EtapaCarrinhoProps {
  vagas: readonly VagaCarrinho[];
  valor: number | null;
  onSelecionar: (id: number) => void;
}

function rotuloOcupacao({ ocupacao, cheia, jaPedida }: VagaCarrinho): string {
  if (jaPedida) return "Você já pediu";
  if (cheia) return "Cheio";
  if (ocupacao === 0) return "Vago";
  return ocupacao === 1 ? "1 pessoa nesta vaga" : `${ocupacao} pessoas nesta vaga`;
}

/** Etapa 3 (última) do wizard: carrinho. Só aparecem os carrinhos ativos (filtro do backend
 * em GET /api/carrinhos) com o turno escolhido configurado no dia escolhido (PLANNING.md
 * regra 17), com a ocupação de cada vaga para o publicador preferir as vazias. Vaga cheia ou
 * já pedida por ele fica desabilitada. */
export function EtapaCarrinho({ vagas, valor, onSelecionar }: EtapaCarrinhoProps) {
  if (vagas.length === 0) {
    return (
      <Alert variant="warning">
        <AlertDescription>
          Nenhum carrinho tem esse turno nesse dia. Toque em "Voltar" e escolha outro turno.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-3" role="radiogroup" aria-label="Carrinho">
      {vagas.map((v) => {
        const c = v.carrinho;
        const selecionado = valor === c.id;
        return (
          <Button
            key={c.id}
            type="button"
            variant="outline"
            size="lg"
            role="radio"
            aria-checked={selecionado}
            disabled={v.cheia || v.jaPedida}
            className={cn(
              // Altura automática + whitespace-normal: a descrição pode quebrar linha em telas
              // estreitas (o botão padrão é de uma linha só, h-12 + whitespace-nowrap).
              "h-auto min-h-12 w-full items-start justify-between gap-3 whitespace-normal py-3 text-left text-base",
              selecionado && "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
            )}
            onClick={() => onSelecionar(c.id)}
          >
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="break-words">{c.nome}</span>
              {c.descricao?.trim() && (
                <span
                  className={cn(
                    "break-words text-sm font-normal",
                    selecionado ? "text-primary-foreground/90" : "text-muted-foreground",
                  )}
                >
                  {c.descricao}
                </span>
              )}
            </span>
            <span className="shrink-0 text-sm font-normal opacity-80">{rotuloOcupacao(v)}</span>
          </Button>
        );
      })}
    </div>
  );
}
