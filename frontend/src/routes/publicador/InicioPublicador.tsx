import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { apiFetch, ApiError } from "../../api/client";
import { ehErroDeJanelaFechada, useJanela } from "../../hooks/useJanela";
import { usePublicadorToken } from "../../hooks/usePublicadorToken";
import { formatarNomeMes, STATUS } from "../../utils/formatacao";
import { GRUPO_WHATSAPP_URL } from "../../constants/whatsapp";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SolicitacaoCard, type Solicitacao } from "./components/SolicitacaoCard";
import { ErroJanela } from "./components/ErroJanela";

function primeiroDiaDoMesAtualIso(): string {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-01`;
}

/** Ordena os pedidos de um mês por dia da semana (Segunda → Sexta), depois por turno
 * (ids em ordem cronológica) e por fim pelo nome do carrinho ("Carrinho 2" antes de
 * "Carrinho 10"). Não altera a lista recebida. */
function ordenarPorDiaTurnoCarrinho(lista: Solicitacao[]): Solicitacao[] {
  return [...lista].sort(
    (a, b) =>
      a.diaSemana - b.diaSemana ||
      a.turnoId - b.turnoId ||
      a.carrinhoNome.localeCompare(b.carrinhoNome, "pt-BR", { numeric: true }),
  );
}

/**
 * Rota "/": tela inicial do publicador. Mostra os pedidos do mês atual e do próximo
 * (mesAlvo). Com a janela aberta, há um botão para solicitar uma nova escala e os pedidos
 * do mês-alvo podem ser excluídos; com ela fechada, um aviso aparece no topo, o botão some
 * e a lista fica só para leitura (PLANNING.md regra 8). O botão fica num rodapé fixo na
 * base da tela, junto com "Terminei!", que volta para o grupo do WhatsApp (os navegadores
 * não deixam o site fechar a própria aba). Se o publicador nunca fez nenhuma
 * solicitação e a janela está aberta, redireciona automaticamente para "/solicitar" —
 * sem precisar clicar em nada (fluxo de primeiro acesso).
 *
 * Meses mais antigos não têm mais tela própria: essa é uma simplificação de produto
 * deliberada, não uma violação da regra de histórico "sempre acessível" do
 * PLANNING.md — os dados continuam no banco, só não há mais UI para eles.
 */
export default function InicioPublicador() {
  // Gera o token no primeiro acesso antes do GET /api/solicitacoes abaixo — sem ele o
  // backend responde 400 e o redirecionamento de primeiro acesso nunca acontece.
  usePublicadorToken();
  const {
    janela,
    carregando: carregandoJanela,
    erro: erroJanela,
    tentarNovamente: tentarJanelaNovamente,
  } = useJanela();
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[] | null>(null);
  const [carregandoSolicitacoes, setCarregandoSolicitacoes] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  // Decidido só na primeira carga: excluir o último pedido esvazia a lista, mas não deve
  // mandar o publicador de volta para o wizard como se fosse o primeiro acesso.
  const [primeiroAcesso, setPrimeiroAcesso] = useState(false);
  const [excluindoId, setExcluindoId] = useState<number | null>(null);
  const [errosExclusao, setErrosExclusao] = useState<Record<number, string>>({});

  useEffect(() => {
    let cancelado = false;

    apiFetch<Solicitacao[]>("/api/solicitacoes")
      .then((resposta) => {
        if (!cancelado) {
          setSolicitacoes(resposta);
          setPrimeiroAcesso(resposta.length === 0);
        }
      })
      .catch((err: unknown) => {
        if (!cancelado) {
          setErro(err instanceof ApiError ? err.message : "Não foi possível carregar seu histórico.");
        }
      })
      .finally(() => {
        if (!cancelado) setCarregandoSolicitacoes(false);
      });

    return () => {
      cancelado = true;
    };
  }, []);

  async function excluirSolicitacao(id: number) {
    setExcluindoId(id);
    setErrosExclusao((prev) => {
      const { [id]: _removido, ...resto } = prev;
      return resto;
    });

    try {
      await apiFetch(`/api/solicitacoes/${id}`, { method: "DELETE" });
      setSolicitacoes((prev) => (prev ? prev.filter((s) => s.id !== id) : prev));
    } catch (err) {
      const mensagem =
        err instanceof ApiError ? err.message : "Não foi possível cancelar a solicitação. Tente novamente.";
      setErrosExclusao((prev) => ({ ...prev, [id]: mensagem }));
      // A janela fechou enquanto a tela estava aberta (ex: virou o dia 26): reconsulta a
      // janela para a tela passar ao modo só leitura, com o aviso no lugar do botão.
      if (ehErroDeJanelaFechada(err)) {
        tentarJanelaNovamente();
      }
    } finally {
      setExcluindoId(null);
    }
  }

  // Espera os dois carregamentos (rodam em paralelo) antes de decidir qualquer coisa,
  // para não mostrar a Home vazia por uma fração de segundo antes de redirecionar.
  if (carregandoJanela || carregandoSolicitacoes) {
    return (
      <p className="text-muted-foreground" role="status">
        Carregando…
      </p>
    );
  }

  if (janela?.aberta && primeiroAcesso) {
    return <Navigate to="/solicitar" replace />;
  }

  const mesesRelevantes = new Set(
    [primeiroDiaDoMesAtualIso(), janela?.mesAlvo].filter((v): v is string => Boolean(v)),
  );
  // Rejeitadas ficam ocultas: sem status na tela, elas pareceriam pedidos válidos (a escala
  // oficial é divulgada pelo administrador no grupo de WhatsApp).
  const relevantes = (solicitacoes ?? []).filter(
    (s) => mesesRelevantes.has(s.escalaMesReferencia) && s.status !== STATUS.Rejeitada,
  );

  const podeSolicitar = !erroJanela && janela?.aberta === true;

  const porMes = new Map<string, Solicitacao[]>();
  for (const s of relevantes) {
    const lista = porMes.get(s.escalaMesReferencia) ?? [];
    lista.push(s);
    porMes.set(s.escalaMesReferencia, lista);
  }

  return (
    <section className="flex flex-col gap-4">
      {erroJanela || !janela ? (
        <ErroJanela onTentarNovamente={tentarJanelaNovamente} />
      ) : janela.aberta ? null : (
        <Alert>
          <AlertTitle>Envio de pedidos fechado</AlertTitle>
          <AlertDescription>
            Os pedidos podem ser enviados do dia 15 ao dia 25 de cada mês. Fora desse período,
            para excluir um pedido, fale com o administrador.
          </AlertDescription>
        </Alert>
      )}

      {erro && (
        <Alert variant="destructive">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      {!erro && relevantes.length === 0 && (
        <Card className="items-center gap-2 py-10 text-center text-muted-foreground">
          Nenhum pedido seu neste mês ou no próximo ainda.
        </Card>
      )}

      {[...porMes.entries()]
        // Datas ISO ordenam como texto: mês mais recente (o mês-alvo) primeiro.
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([mes, lista]) => (
          <div key={mes} className="flex flex-col gap-4">
            <h2 className="mt-2 text-base font-normal text-muted-foreground">
              Minhas solicitações para {formatarNomeMes(mes)}
            </h2>
            <ul className="flex list-none flex-col gap-3 p-0">
              {ordenarPorDiaTurnoCarrinho(lista).map((s) => (
                <li key={s.id}>
                  <SolicitacaoCard
                    solicitacao={s}
                    exclusaoPermitida={janela?.aberta === true && mes === janela.mesAlvo}
                    excluindo={excluindoId === s.id}
                    erro={errosExclusao[s.id]}
                    onExcluir={excluirSolicitacao}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}

      {(podeSolicitar || GRUPO_WHATSAPP_URL) && (
        <>
          {/* Reserva o espaço do rodapé fixo para ele não cobrir o último card. */}
          <div
            aria-hidden
            className={
              podeSolicitar && GRUPO_WHATSAPP_URL
                ? "h-[calc(5.5rem+env(safe-area-inset-bottom))]"
                : "h-[calc(2rem+env(safe-area-inset-bottom))]"
            }
          />
          <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background">
            <div className="mx-auto flex max-w-4xl flex-col gap-2 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {podeSolicitar && (
                <Button asChild size="lg" className="w-full">
                  <Link to="/solicitar">Solicitar Nova Escala</Link>
                </Button>
              )}
              {GRUPO_WHATSAPP_URL && (
                // Link comum: no celular o sistema entrega o chat.whatsapp.com ao app do WhatsApp.
                <Button asChild size="lg" variant="outline" className="w-full">
                  <a href={GRUPO_WHATSAPP_URL}>Terminei!</a>
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
