import { useJanela } from "../../hooks/useJanela";
import JanelaFechada from "./JanelaFechada";
import { ErroJanela } from "./components/ErroJanela";
import { SolicitacaoWizard } from "./wizard/SolicitacaoWizard";

/**
 * Rota "/solicitar": decide entre mostrar o aviso de janela fechada ou o wizard de
 * solicitação, com base em useJanela(). A tela inicial só mostra o botão que leva para cá
 * com a janela aberta; o aviso de fechada aqui é rede de segurança para acesso direto à URL.
 */
export default function SolicitarEscala() {
  const { janela, carregando, erro, tentarNovamente } = useJanela();

  if (carregando) {
    return <p className="text-muted-foreground">Carregando…</p>;
  }

  if (erro || !janela) {
    return <ErroJanela onTentarNovamente={tentarNovamente} />;
  }

  if (!janela.aberta) {
    return <JanelaFechada />;
  }

  return <SolicitacaoWizard mesAlvo={janela.mesAlvo} />;
}
