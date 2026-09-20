import { Link } from "react-router-dom";

/**
 * Tela informativa exibida ao publicador quando a janela de envio está
 * fechada (dia 26 ao dia 14 do mês seguinte — PLANNING.md §4).
 *
 * Puramente apresentacional: não faz chamadas à API. A decisão de QUANDO
 * mostrar esta tela (via useJanela()) é responsabilidade do roteamento,
 * definido em outra tarefa.
 */
export default function JanelaFechada() {
  return (
    <div className="janela-fechada painel estreita">
      <h1>Envio fechado</h1>
      <p className="janela-fechada__dia" aria-hidden="true">
        15
      </p>
      <p>Novos pedidos abrem novamente no dia 15.</p>
      <p className="subtitulo">
        Os pedidos para a escala do mês seguinte podem ser enviados do dia 15 ao dia 25 de cada
        mês.
      </p>
      <Link to="/historico" className="btn--link">
        Ver meu histórico
      </Link>
    </div>
  );
}
