import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { formatarDataCurta } from "../../../utils/formatacao";
import type { Carrinho } from "./SolicitacaoWizard";

/** Um carrinho com o (dia, turno) escolhido configurado. */
export interface VagaCarrinho {
  carrinho: Carrinho;
  ocupacao: number;
  /** Vaga cheia: o backend recusa novos pedidos de publicador (PLANNING.md regra 3). */
  cheia: boolean;
  /** Primeiro nome de quem já está na vaga, para o publicador formar a dupla (issue #33). */
  nomes: readonly string[];
  /** O publicador já tem pedido nesse horário num carrinho do mesmo grupo (PLANNING.md regra 10). */
  jaTemPedido: boolean;
}

/** "Você já tem pedido…" e "Cheio" justificam o desabilitado, sem nomes (a vaga não pode ser
 * escolhida); "Com: Maria" ajuda a completar a dupla (a vaga vazia não diz nada). */
function rotuloOcupacao({ ocupacao, cheia, nomes, jaTemPedido }: VagaCarrinho): string | null {
  if (jaTemPedido) return "Você já tem pedido neste horário";
  if (cheia) return "Cheio";
  if (nomes.length > 0) return `Com: ${nomes.join(", ")}`;
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
 * regra 17). A vaga cheia fica desabilitada com "Cheio"; a com uma pessoa mostra o primeiro
 * nome dela ("Com: Maria"); a vazia, nada. O carrinho de data especial (regra 10a) mostra a data e não
 * conflita com os normais: quem já tem pedido no horário só vê desabilitados, com o aviso, os
 * carrinhos do mesmo grupo. */
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
            disabled={v.cheia || v.jaTemPedido}
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
              {c.dataEspecial && (
                <span
                  className={cn(
                    "text-sm font-semibold",
                    selecionado ? "text-primary-foreground/90" : "text-muted-foreground",
                  )}
                >
                  Somente em {formatarDataCurta(c.dataEspecial)}
                </span>
              )}
            </span>
            {rotuloOcupacao(v) && (
              <span className="min-w-0 shrink-0 break-words text-right text-sm font-normal opacity-80">
                {rotuloOcupacao(v)}
              </span>
            )}
          </Button>
        );
      })}
    </div>
  );
}
