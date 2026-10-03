import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeftIcon, ShareIcon } from "lucide-react";
import { apiFetch } from "../../api/client";
import { formatarMes, formatarTurno } from "../../utils/formatacao";
import { compartilharImagem, slug } from "../../utils/imagemEscala";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import cabecalho from "../../assets/cabecalho-escala.jpg";
import { escalaParaCompartilhar, type CarrinhoParaCompartilhar } from "./components/escalaParaCompartilhar";
import type { EscalaGradeResponse } from "./components/gradeEscala";

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** O que vira imagem: cabeçalho com a foto, carrinho em destaque e só os turnos com gente. */
function CartaoCarrinho({
  carrinho,
  mesTexto,
  cartaoRef,
}: {
  carrinho: CarrinhoParaCompartilhar;
  mesTexto: string;
  cartaoRef: (el: HTMLElement | null) => void;
}) {
  return (
    <article ref={cartaoRef} className="w-full max-w-[28rem] overflow-hidden bg-white text-[#1f2933]">
      <div className="relative">
        <img src={cabecalho} alt="" className="block h-36 w-full object-cover" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pt-8 pb-2.5">
          <p className="text-[0.95rem] font-semibold tracking-wide text-white uppercase">Escala TPL</p>
          <p className="text-xl leading-tight font-bold text-white">{mesTexto}</p>
        </div>
      </div>

      <div className="bg-primary px-4 py-3.5 text-primary-foreground">
        <h2 className="m-0 text-[1.6rem] leading-tight font-extrabold">{carrinho.nome}</h2>
        {carrinho.descricao && <p className="mt-1 text-[1.05rem] leading-snug opacity-95">{carrinho.descricao}</p>}
      </div>

      <div className="flex flex-col gap-4 px-4 py-4">
        {carrinho.dias.map((dia) => (
          <section key={dia.dia}>
            <h3 className="m-0 border-b-2 border-primary pb-1 text-[1.1rem] font-bold text-primary uppercase">
              {dia.rotulo}
            </h3>
            <ul className="m-0 list-none p-0">
              {dia.turnos.map((turno) => (
                <li
                  key={turno.turnoId}
                  data-turno
                  className="flex items-baseline gap-3 border-b border-[#e4e7eb] py-2 last:border-b-0"
                >
                  <span className="w-[7.5rem] shrink-0 text-[1.05rem] font-bold tabular-nums">
                    {formatarTurno(turno.turnoId)}
                  </span>
                  <ul className="m-0 min-w-0 flex-1 list-none p-0 text-[1.1rem] leading-snug">
                    {turno.nomes.map((nome, i) => (
                      <li key={i}>{nome}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </article>
  );
}

/**
 * Escala do mês só para leitura, uma imagem por carrinho, para mandar no grupo do WhatsApp
 * (ou tirar print). Mostra só dias e turnos com gente, sem cor de estado de vaga e sem ações.
 */
export default function EscalaCompartilhar() {
  const { mes } = useParams<{ mes: string }>();
  const [carrinhos, setCarrinhos] = useState<CarrinhoParaCompartilhar[] | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [gerando, setGerando] = useState<number | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const cartoes = useRef(new Map<number, HTMLElement>());

  useEffect(() => {
    if (!mes) return;

    let cancelado = false;
    setCarregando(true);
    setErro(null);

    apiFetch<EscalaGradeResponse>(`/api/admin/escalas/${mes}/grade`)
      .then((resposta) => {
        if (!cancelado) setCarrinhos(escalaParaCompartilhar(resposta.celulas));
      })
      .catch(() => {
        if (!cancelado) setErro("Não foi possível carregar a escala. Tente novamente.");
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [mes]);

  if (!mes) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Mês da escala não informado na URL.</AlertDescription>
      </Alert>
    );
  }

  const mesTexto = capitalizar(formatarMes(mes));

  async function compartilhar(carrinho: CarrinhoParaCompartilhar) {
    const cartao = cartoes.current.get(carrinho.carrinhoId);
    if (!cartao) return;
    setAviso(null);
    setErro(null);
    setGerando(carrinho.carrinhoId);
    try {
      const resultado = await compartilharImagem(
        cartao,
        `escala-${mes}-${slug(carrinho.nome)}`,
        `Escala TPL — ${carrinho.nome} — ${mesTexto}`,
      );
      if (resultado === "baixado") setAviso(`Imagem de ${carrinho.nome} baixada.`);
    } catch {
      setErro("Não foi possível gerar a imagem. Tire um print da tela.");
    } finally {
      setGerando(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Link to={`/admin/escalas/${mes}`} className="inline-flex items-center gap-1 text-sm no-underline">
          <ArrowLeftIcon aria-hidden className="size-4" />
          Voltar à escala
        </Link>
        <h1>Compartilhar escala</h1>
        <p className="text-muted-foreground">
          {mesTexto}. Uma imagem por carrinho, só com os dias e turnos que têm gente.
        </p>
      </div>

      <p role="status" className="text-[0.95rem] font-semibold text-success empty:hidden">
        {aviso}
      </p>
      {erro && (
        <Alert variant="destructive">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      {carregando && <p className="text-muted-foreground">Carregando escala…</p>}

      {!carregando && carrinhos && carrinhos.length === 0 && (
        <p className="text-muted-foreground">Nenhum pedido em {mesTexto} para compartilhar.</p>
      )}

      {carrinhos?.map((carrinho) => (
        <section key={carrinho.carrinhoId} className="flex flex-col gap-2">
          <div className="overflow-hidden rounded-lg border border-border shadow-sm">
            <CartaoCarrinho
              carrinho={carrinho}
              mesTexto={mesTexto}
              cartaoRef={(el) => {
                if (el) cartoes.current.set(carrinho.carrinhoId, el);
                else cartoes.current.delete(carrinho.carrinhoId);
              }}
            />
          </div>
          <Button
            type="button"
            size="lg"
            disabled={gerando !== null}
            aria-label={`Compartilhar imagem — ${carrinho.nome}`}
            onClick={() => compartilhar(carrinho)}
          >
            <ShareIcon aria-hidden />
            {gerando === carrinho.carrinhoId ? "Gerando imagem…" : "Compartilhar imagem"}
          </Button>
        </section>
      ))}
    </div>
  );
}
