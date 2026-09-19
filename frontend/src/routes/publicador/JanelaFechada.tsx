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
    <div className="janela-fechada">
      <h1>Envio fechado</h1>
      <p className="janela-fechada__mensagem">Envio fechado. Abre novamente no dia 15.</p>
      <p className="janela-fechada__detalhe">
        As solicitações para a escala do mês seguinte podem ser enviadas do dia 15 ao dia 25 de
        cada mês. Fora desse período, aguarde a próxima abertura da janela de envio.
      </p>
      <p>
        <Link to="/historico">Ver meu histórico de solicitações</Link>
      </p>
    </div>
  );
}
