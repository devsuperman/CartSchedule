import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeftIcon, ShareIcon } from "lucide-react";
import { apiFetch } from "../../api/client";
import { formatarMes, formatarTurno } from "../../utils/formatacao";
import { compartilharImagem } from "../../utils/imagemEscala";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import cabecalho from "../../assets/cabecalho-escala.jpg";
import {
  escalaParaCompartilhar,
  escalaVazia,
  type CarrinhoColuna,
  type EscalaParaCompartilhar,
  type LinhaTurno,
} from "./components/escalaParaCompartilhar";
import type { EscalaGradeResponse } from "./components/gradeEscala";

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * Grade de um dia: turnos nas linhas, carrinhos (só o nome) nas colunas, nomes nas
 * células. A descrição do carrinho fica na legenda (`LegendaCarrinhos`), uma vez por imagem. Vaga sem ninguém fica em branco (sem "Vago" nem estado de vaga).
 * Texto sem quebra de linha e com folga à direita: o html-to-image copia o tamanho de cada
 * célula da tela mas desenha com outra fonte (skipFonts), e um texto que quebrasse diferente
 * vazaria para a linha de baixo na imagem.
 */
function GradeDoDia({ carrinhos, turnos }: { carrinhos: CarrinhoColuna[]; turnos: LinhaTurno[] }) {
  return (
    <table className="w-full border-collapse text-left">
      <thead>
        <tr className="border-b-2 border-primary">
          <th scope="col" className="w-[6.5rem] py-1 pr-3 pl-1.5 align-bottom text-[0.85rem] font-semibold text-[#52606d]">
            Horário
          </th>
          {carrinhos.map((carrinho) => (
            <th
              key={carrinho.carrinhoId}
              scope="col"
              className="border-l border-[#e4e7eb] py-1 pr-4 pl-2 align-bottom whitespace-nowrap"
            >
              <div className="min-w-[8rem] text-[1rem] leading-snug font-bold">{carrinho.nome}</div>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {turnos.map((turno) => (
          <tr key={turno.turnoId} data-turno className="border-b border-[#e4e7eb] last:border-b-0 even:bg-[#f5f7fa]">
            <th
              scope="row"
              className="py-1 pr-3 pl-1.5 align-top text-[0.95rem] font-bold whitespace-nowrap text-primary tabular-nums"
            >
              {formatarTurno(turno.turnoId)}
            </th>
            {turno.nomes.map((nomes, i) => (
              <td
                key={carrinhos[i].carrinhoId}
                className="border-l border-[#e4e7eb] py-1 pr-4 pl-2 align-top whitespace-nowrap"
              >
                <div className="min-w-[8rem] text-[1rem] leading-snug">
                  {nomes.map((nome, j) => (
                    <span key={j} className="block">
                      {nome}
                    </span>
                  ))}
                </div>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Descrição dos carrinhos, uma vez por imagem, acima das grades — fora das colunas, para a
 * descrição (até 500 caracteres) não alargar a grade. Só os carrinhos com descrição; sem nenhum,
 * não aparece. `w-0 min-w-full`: a largura vem da grade, não do texto, e a descrição quebra
 * linha. Folga embaixo e entrelinha generosa porque o html-to-image desenha com outra fonte
 * (skipFonts) e o texto quebrado pode ocupar um pouco mais que na tela.
 */
function LegendaCarrinhos({ carrinhos }: { carrinhos: CarrinhoColuna[] }) {
  const comDescricao = carrinhos.filter((c) => c.descricao);
  if (comDescricao.length === 0) return null;
  return (
    <section aria-label="Carrinhos" className="w-0 min-w-full pb-1">
      <p className="m-0 text-[0.85rem] font-semibold tracking-wide text-[#52606d] uppercase">Carrinhos</p>
      <dl className="m-0 flex flex-col gap-1">
        {comDescricao.map((carrinho) => (
          <div key={carrinho.carrinhoId} className="text-[0.9rem] leading-normal break-words">
            <dt className="inline font-bold">{carrinho.nome}</dt>
            <span aria-hidden> — </span>
            <dd className="m-0 inline text-[#3e4c59]">{carrinho.descricao}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** O que vira imagem: cabeçalho com a foto ("Escala TPL" + mês) e o conteúdo. */
function Cartao({
  mesTexto,
  cartaoRef,
  children,
}: {
  mesTexto: string;
  cartaoRef: (el: HTMLElement | null) => void;
  children: ReactNode;
}) {
  return (
    <article ref={cartaoRef} className="w-max min-w-[22rem] overflow-hidden bg-white text-[#1f2933]">
      <div className="relative">
        <img src={cabecalho} alt="" className="block h-28 w-full object-cover" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pt-8 pb-2.5">
          <p className="text-[0.95rem] font-semibold tracking-wide text-white uppercase">Escala TPL</p>
          <p className="text-xl leading-tight font-bold text-white">{mesTexto}</p>
        </div>
      </div>
      {children}
    </article>
  );
}

interface Imagem {
  chave: string;
  /** Usado no botão, no aviso e no título da imagem. */
  nome: string;
  arquivo: string;
  conteudo: ReactNode;
}

function imagensDaEscala(escala: EscalaParaCompartilhar, mes: string, mesTexto: string): Imagem[] {
  const imagens: Imagem[] = [];
  if (escala.semanal.dias.length > 0) {
    imagens.push({
      chave: "mes",
      nome: mesTexto,
      arquivo: `escala-${mes}`,
      conteudo: (
        <div className="flex flex-col gap-3 px-4 py-3">
          <LegendaCarrinhos carrinhos={escala.semanal.carrinhos} />
          {escala.semanal.dias.map((dia) => (
            <section key={dia.dia}>
              <h3 className="m-0 rounded-sm bg-primary px-2 py-0.5 text-[1rem] font-bold text-primary-foreground uppercase">
                {dia.rotulo}
              </h3>
              <GradeDoDia carrinhos={escala.semanal.carrinhos} turnos={dia.turnos} />
            </section>
          ))}
        </div>
      ),
    });
  }
  for (const especial of escala.datasEspeciais) {
    imagens.push({
      chave: especial.data,
      nome: especial.rotulo,
      arquivo: `escala-${especial.data}`,
      conteudo: (
        <>
          <div className="bg-primary px-4 py-3 text-primary-foreground">
            <h3 className="m-0 text-[1.4rem] leading-tight font-extrabold">{especial.rotulo}</h3>
            <p className="m-0 mt-0.5 text-[1rem] opacity-95">Somente nesta data</p>
          </div>
          <div className="flex flex-col gap-3 px-4 py-3">
            <LegendaCarrinhos carrinhos={especial.carrinhos} />
            <GradeDoDia carrinhos={especial.carrinhos} turnos={especial.turnos} />
          </div>
        </>
      ),
    });
  }
  return imagens;
}

/**
 * Escala do mês só para leitura, para mandar no grupo do WhatsApp (ou tirar print): uma imagem
 * do mês na ordem em que as pessoas procuram (dia → turno → carrinho) e uma imagem por data
 * especial (regra 10a). Só com o que tem gente, sem cor de estado de vaga e sem ações.
 */
export default function EscalaCompartilhar() {
  const { mes } = useParams<{ mes: string }>();
  const [escala, setEscala] = useState<EscalaParaCompartilhar | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [gerando, setGerando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const cartoes = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    if (!mes) return;

    let cancelado = false;
    setCarregando(true);
    setErro(null);

    apiFetch<EscalaGradeResponse>(`/api/admin/escalas/${mes}/grade`)
      .then((resposta) => {
        if (!cancelado) setEscala(escalaParaCompartilhar(resposta.celulas));
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
  const imagens = escala ? imagensDaEscala(escala, mes, mesTexto) : [];

  async function compartilhar(imagem: Imagem) {
    const cartao = cartoes.current.get(imagem.chave);
    if (!cartao) return;
    setAviso(null);
    setErro(null);
    setGerando(imagem.chave);
    try {
      const resultado = await compartilharImagem(cartao, imagem.arquivo, `Escala TPL — ${imagem.nome}`);
      if (resultado === "baixado") setAviso(`Imagem de ${imagem.nome} baixada.`);
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
          {mesTexto}. Uma imagem do mês, por dia e horário, com os carrinhos nas colunas (a descrição
          de cada um vem no topo) e só quem tem pedido; cada data especial vem numa imagem separada. No WhatsApp, envie em HD para os nomes ficarem nítidos.
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

      {!carregando && escala && escalaVazia(escala) && (
        <p className="text-muted-foreground">Nenhum pedido em {mesTexto} para compartilhar.</p>
      )}

      {imagens.map((imagem) => (
        <section key={imagem.chave} className="flex flex-col gap-2">
          <div className="overflow-x-auto rounded-lg border border-border shadow-sm">
            <Cartao
              mesTexto={mesTexto}
              cartaoRef={(el) => {
                if (el) cartoes.current.set(imagem.chave, el);
                else cartoes.current.delete(imagem.chave);
              }}
            >
              {imagem.conteudo}
            </Cartao>
          </div>
          <Button
            type="button"
            size="lg"
            disabled={gerando !== null}
            aria-label={`Compartilhar imagem — ${imagem.nome}`}
            onClick={() => compartilhar(imagem)}
          >
            <ShareIcon aria-hidden />
            {gerando === imagem.chave ? "Gerando imagem…" : "Compartilhar imagem"}
          </Button>
        </section>
      ))}
    </div>
  );
}
