import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatarDia, formatarTurno, STATUS } from "../../../utils/formatacao";

/** Contrato de GET /api/solicitacoes (uma solicitação do publicador autenticado via token). */
export interface Solicitacao {
  id: number;
  escalaMesReferencia: string;
  carrinhoId: number;
  carrinhoNome: string;
  carrinhoDescricao: string | null;
  diaSemana: number;
  turnoId: number;
  status: number;
  origem: number;
}

interface SolicitacaoCardProps {
  solicitacao: Solicitacao;
  /** Janela aberta e solicitação da escala do mês-alvo — decidido pela tela, que conhece a janela. */
  exclusaoPermitida: boolean;
  excluindo: boolean;
  erro?: string;
  onExcluir: (id: number) => void;
}

/** Card de uma solicitação do publicador. A informação principal é o dia da semana com o
 * turno ao lado (os dois em destaque) e, abaixo, o carrinho, com a descrição logo abaixo do
 * nome quando houver. O status não aparece: a escala oficial é divulgada pelo administrador
 * fora do sistema (grupo de WhatsApp). À direita, botão de excluir,
 * quando Pendente/Aprovada e a exclusão é permitida — só com a janela aberta e para a
 * escala do mês-alvo (PLANNING.md regra 8). A exclusão pede confirmação no próprio card
 * (nunca window.confirm). Fora disso, só o administrador mexe no pedido. */
export function SolicitacaoCard({
  solicitacao,
  exclusaoPermitida,
  excluindo,
  erro,
  onExcluir,
}: SolicitacaoCardProps) {
  const [confirmando, setConfirmando] = useState(false);
  const podeExcluir =
    exclusaoPermitida &&
    (solicitacao.status === STATUS.Pendente || solicitacao.status === STATUS.Aprovada);
  const descricao = solicitacao.carrinhoDescricao?.trim();

  return (
    <Card className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 p-4 sm:p-5">
      <span className="flex flex-wrap items-baseline gap-x-3 text-[1.05rem] font-bold">
        <span>{formatarDia(solicitacao.diaSemana)}</span>
        <span className="tabular-nums">{formatarTurno(solicitacao.turnoId)}</span>
      </span>
      <span className="row-span-2 flex flex-col items-end gap-2">
        {podeExcluir && !confirmando && (
          <Button type="button" variant="destructive" size="sm" onClick={() => setConfirmando(true)}>
            Excluir pedido
          </Button>
        )}
      </span>
      <span className="flex flex-col">
        <span className="text-sm font-medium">{solicitacao.carrinhoNome}</span>
        {descricao && <span className="text-sm text-muted-foreground">{descricao}</span>}
      </span>
      {podeExcluir && confirmando && (
        <div className="col-span-full mt-2 flex flex-wrap items-center justify-end gap-2">
          <span className="mr-auto text-[0.95rem] font-semibold">Excluir este pedido?</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setConfirmando(false)}
            disabled={excluindo}
          >
            Voltar
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => onExcluir(solicitacao.id)}
            disabled={excluindo}
          >
            {excluindo ? "Excluindo…" : "Confirmar"}
          </Button>
        </div>
      )}
      {erro && (
        <Alert variant="destructive" className="col-span-full py-2 text-[0.95rem]">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}
    </Card>
  );
}
