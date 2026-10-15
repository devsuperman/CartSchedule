import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type { Carrinho } from "./SolicitacaoWizard";

/** Um carrinho com o (dia, turno) escolhido configurado. */
export interface VagaCarrinho {
  carrinho: Carrinho;
  ocupacao: number;
  /** Vaga cheia: o backend recusa novos pedidos de publicador (PLANNING.md regra 3). */
  cheia: boolean;
}

/** "Cheio" justifica o desabilitado; "1 pessoa nesta vaga" ajuda a completar a dupla (a vaga
 * vazia não diz nada). */
function rotuloOcupacao({ ocupacao, cheia }: VagaCarrinho): string | null {
  if (cheia) return "Cheio";
  if (ocupacao === 1) return "1 pessoa nesta vaga";
  return null;
}

interface EtapaCarrinhoProps {
  vagas: readonly VagaCarrinho[];
  valor: number | null;
  onSelecionar: (id: number) => void;
}

/** Etapa 3 (última) do wizard: carrinho. Só aparecem os carrinhos ativos (filtro do backend
 * em GET /api/carrinhos) com o turno escolhido configurado no dia escolhido (PLANNING.md
 * regra 17). A vaga cheia fica desabilitada com "Cheio"; a com uma pessoa mostra "1 pessoa
 * nesta vaga"; a vazia, nada (horário em que ele já tem pedido nem chega aqui: o turno fica
 * desabilitado). */
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
            disabled={v.cheia}
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
            {rotuloOcupacao(v) && (
              <span className="shrink-0 text-sm font-normal opacity-80">{rotuloOcupacao(v)}</span>
            )}
          </Button>
        );
      })}
    </div>
  );
}
