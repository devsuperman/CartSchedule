import { formatarDia, formatarTurno } from "../../../utils/formatacao";

/** Contrato de GET /api/admin/escalas/{mes}/grade (TECHNICAL_SPEC.md, F2-BE-07 / F13-BE-02). */
export interface PedidoGrade {
  solicitacaoId: number;
  publicadorId: string;
  publicadorNome: string;
  origem: number; // 1=Publicador, 2=Administrador
  /** Contagem de apoio (regra 13): pedidos desta pessoa na escala inteira. */
  totalNaEscala: number;
}

export interface CelulaGrade {
  carrinhoId: number;
  carrinhoNome: string;
  diaSemana: number;
  turnoId: number;
  /** Vaga configurada para o carrinho (ativo) nesse dia. Se false, a célula só existe por
   * ter pedidos antigos (turno removido/carrinho desativado) e não recebe ninguém. */
  disponivel: boolean;
  publicadores: PedidoGrade[];
}

export interface EscalaGradeResponse {
  mes: string;
  celulas: CelulaGrade[];
}

/** Meta de pessoas por vaga — só sinalização, nunca bloqueio (regra 3). */
export const LIMITE_POR_VAGA = 2;

export type ChaveCelula = string;

export function chaveCelula(c: { carrinhoId: number; diaSemana: number; turnoId: number }): ChaveCelula {
  return `${c.carrinhoId}-${c.diaSemana}-${c.turnoId}`;
}

export function descreverCelula(c: CelulaGrade): string {
  return `${c.carrinhoNome}, ${formatarDia(c.diaSemana)}, ${formatarTurno(c.turnoId)}`;
}

export function ocupacao(c: CelulaGrade): string {
  const n = c.publicadores.length;
  if (n === 0) return "livre";
  if (n < LIMITE_POR_VAGA) return `${n} de ${LIMITE_POR_VAGA}`;
  if (n === LIMITE_POR_VAGA) return "cheia";
  return `${n} pessoas`;
}

export function localizarPedido(
  celulas: CelulaGrade[],
  solicitacaoId: number,
): { pedido: PedidoGrade; celula: CelulaGrade } | null {
  for (const celula of celulas) {
    const pedido = celula.publicadores.find((p) => p.solicitacaoId === solicitacaoId);
    if (pedido) return { pedido, celula };
  }
  return null;
}

function comTotal(celulas: CelulaGrade[], publicadorId: string, delta: number): CelulaGrade[] {
  return celulas.map((c) => ({
    ...c,
    publicadores: c.publicadores.map((p) =>
      p.publicadorId === publicadorId ? { ...p, totalNaEscala: p.totalNaEscala + delta } : p,
    ),
  }));
}

/** Tira o pedido excluído e desconta 1 da contagem de apoio da pessoa. Células que não são
 * vagas disponíveis e ficaram vazias somem (só existiam pelos pedidos antigos). */
export function semPedido(celulas: CelulaGrade[], solicitacaoId: number): CelulaGrade[] {
  const achado = localizarPedido(celulas, solicitacaoId);
  if (!achado) return celulas;

  const restantes = celulas
    .map((c) => ({ ...c, publicadores: c.publicadores.filter((p) => p.solicitacaoId !== solicitacaoId) }))
    .filter((c) => c.disponivel || c.publicadores.length > 0);

  return comTotal(restantes, achado.pedido.publicadorId, -1);
}

/** Leva o pedido para a célula de destino (no fim da lista); a contagem da pessoa não muda. */
export function moverPedido(celulas: CelulaGrade[], solicitacaoId: number, destino: ChaveCelula): CelulaGrade[] {
  const achado = localizarPedido(celulas, solicitacaoId);
  if (!achado) return celulas;

  return celulas
    .map((c) => {
      const semEle = c.publicadores.filter((p) => p.solicitacaoId !== solicitacaoId);
      return chaveCelula(c) === destino
        ? { ...c, publicadores: [...semEle, achado.pedido] }
        : { ...c, publicadores: semEle };
    })
    .filter((c) => c.disponivel || c.publicadores.length > 0);
}

/** Acrescenta um pedido novo (adição manual) e soma 1 à contagem de apoio da pessoa. */
export function comPedido(
  celulas: CelulaGrade[],
  destino: ChaveCelula,
  novo: Omit<PedidoGrade, "totalNaEscala">,
): CelulaGrade[] {
  const atuais = celulas.flatMap((c) => c.publicadores).filter((p) => p.publicadorId === novo.publicadorId).length;
  const somados = comTotal(celulas, novo.publicadorId, 1);

  return somados.map((c) =>
    chaveCelula(c) === destino
      ? { ...c, publicadores: [...c.publicadores, { ...novo, totalNaEscala: atuais + 1 }] }
      : c,
  );
}

export function renomear(celulas: CelulaGrade[], publicadorId: string, nome: string): CelulaGrade[] {
  return celulas.map((c) => ({
    ...c,
    publicadores: c.publicadores.map((p) => (p.publicadorId === publicadorId ? { ...p, publicadorNome: nome } : p)),
  }));
}
