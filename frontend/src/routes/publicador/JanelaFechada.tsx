import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Tela informativa exibida ao publicador quando a janela de envio está
 * fechada — o administrador fechou o envio; o próximo abre sozinho no dia 15
 * (PLANNING.md §4).
 *
 * Puramente apresentacional: não faz chamadas à API. A decisão de QUANDO
 * mostrar esta tela (via useJanela()) é responsabilidade do roteamento,
 * definido em outra tarefa.
 */
export default function JanelaFechada() {
  return (
    <Card className="mx-auto w-full max-w-[34rem] items-center gap-3 py-10 text-center">
      <h1>Envio fechado</h1>
      <p className="text-6xl leading-none font-bold text-primary tabular-nums" aria-hidden="true">
        15
      </p>
      <p>Novos pedidos abrem novamente no dia 15.</p>
      <p className="text-muted-foreground">
        Todo dia 15 abre o envio de pedidos para a escala do mês seguinte, até o administrador
        encerrar.
      </p>
      <Link to="/" className={cn(buttonVariants({ variant: "outline" }), "mt-2")}>
        Voltar para o início
      </Link>
    </Card>
  );
}
