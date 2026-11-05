import { toPng } from "html-to-image";

const LARGURA_MAXIMA_PX = 1440;
/** O Safari do iPhone não desenha canvas acima de ~16,7 milhões de pixels (sai em branco). */
const AREA_MAXIMA_PX = 16_000_000;

/**
 * Fator de escala da imagem: largura final ≈ 1080–1440px (nítida no WhatsApp sem pesar demais),
 * sem passar da área que o Safari do iPhone consegue desenhar.
 */
export function escalaDaImagem(largura: number, altura: number): number {
  if (largura <= 0 || altura <= 0) return 1;
  return Math.min(3, LARGURA_MAXIMA_PX / largura, Math.sqrt(AREA_MAXIMA_PX / (largura * altura)));
}

async function renderizar(elemento: HTMLElement): Promise<Blob> {
  const opcoes = {
    pixelRatio: escalaDaImagem(elemento.offsetWidth, elemento.offsetHeight),
    cacheBust: false,
    skipFonts: true,
    backgroundColor: "#ffffff",
  };
  // O Safari costuma desenhar em branco a primeira imagem de um nó novo; a 1ª passada aquece.
  await toPng(elemento, opcoes);
  const resposta = await fetch(await toPng(elemento, opcoes));
  return resposta.blob();
}

export type ResultadoCompartilhar = "compartilhado" | "baixado" | "cancelado";

/**
 * Gera o PNG do elemento e abre a folha de compartilhar do celular (WhatsApp incluso). Sem
 * suporte a compartilhar arquivo (computador), baixa a imagem.
 */
export async function compartilharImagem(
  elemento: HTMLElement,
  nomeArquivo: string,
  titulo: string,
): Promise<ResultadoCompartilhar> {
  const blob = await renderizar(elemento);
  const arquivo = new File([blob], `${nomeArquivo}.png`, { type: "image/png" });

  if (navigator.canShare?.({ files: [arquivo] })) {
    try {
      await navigator.share({ files: [arquivo], title: titulo });
      return "compartilhado";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "cancelado";
      // Falha real ao compartilhar: cai no download.
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = arquivo.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "baixado";
}
