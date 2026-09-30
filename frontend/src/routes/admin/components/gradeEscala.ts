import { formatarDia, formatarTurno } from "../../../utils/formatacao";

/** Contrato de GET /api/admin/escalas/{mes}/grade (TECHNICAL_SPEC.md, F2-BE-07 / F13-BE-02). */
export interface PedidoGrade {
  solicitacaoId: number;
  publicadorId: string;
  publicadorNome: string;
  origem: number; // 1=Publicador, 2=Administrador
  /** Contagem de apoio (regra 13): pedidos desta pessoa na escala inteira. */
  totalNaEscala: number;
  /** Pode ser a 3ª pessoa da vaga sem excesso (PLANNING.md regra 1). */
  criancaOuIdoso: boolean;
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

/** Envio de pedidos dos publicadores (PLANNING.md §4): abre sozinho no dia 15, só o admin fecha. */
export interface EnvioEscala {
  aberto: boolean;
}

export interface EscalaGradeResponse {
  mes: string;
  celulas: CelulaGrade[];
  /** Só na escala em envio (a única que pode ser fechada/reaberta); nas demais, null. */
  envio: EnvioEscala | null;
}

/**
 * Estado da vaga pela meta da regra 1 do PLANNING.md — só sinalização, nunca bloqueio (regra 3):
 * 2 pessoas, ou 3 se ao menos uma for criança ou idoso. Vaga com 1 pessoa (mesmo criança ou
 * idoso) e vaga com excesso pedem a atenção do admin; a tela mostra o estado só pela cor.
 */
export type EstadoVaga = "vazia" | "incompleta" | "completa" | "excesso";

export function estadoDe(pessoas: Pick<PedidoGrade, "criancaOuIdoso">[]): EstadoVaga {
  const n = pessoas.length;
  if (n === 0) return "vazia";
  if (n === 1) return "incompleta";
  if (n === 2) return "completa";
  if (n === 3 && pessoas.some((p) => p.criancaOuIdoso)) return "completa";
  return "excesso";
}

export function estadoVaga(c: CelulaGrade): EstadoVaga {
  return estadoDe(c.publicadores);
}

/** Como a vaga fica se essa pessoa entrar nela. */
export function estadoCom(c: CelulaGrade, pessoa: Pick<PedidoGrade, "criancaOuIdoso">): EstadoVaga {
  return estadoDe([...c.publicadores, pessoa]);
}

/** Como a vaga fica se esse pedido sair dela. */
export function estadoSem(c: CelulaGrade, solicitacaoId: number): EstadoVaga {
  return estadoDe(c.publicadores.filter((p) => p.solicitacaoId !== solicitacaoId));
}

export function precisaAtencao(estado: EstadoVaga): boolean {
  return estado === "incompleta" || estado === "excesso";
}

/** O estado em palavras — só para leitor de tela; na tela, é a cor que fala. */
export const ROTULO_ESTADO: Record<EstadoVaga, string> = {
  vazia: "vaga vazia",
  incompleta: "vaga com 1 pessoa",
  completa: "vaga completa",
  excesso: "vaga com excesso",
};

/** Fundo + barra à esquerda: verde na completa, vermelho quando precisa de atenção. */
export function classeEstado(estado: EstadoVaga): string | false {
  if (estado === "completa") return "bg-success-muted shadow-[inset_3px_0_0_var(--color-success)]";
  if (precisaAtencao(estado)) return "bg-destructive-muted shadow-[inset_3px_0_0_var(--color-destructive)]";
  return false;
}

export type ChaveCelula = string;

export function chaveCelula(c: { carrinhoId: number; diaSemana: number; turnoId: number }): ChaveCelula {
  return `${c.carrinhoId}-${c.diaSemana}-${c.turnoId}`;
}

export function descreverCelula(c: CelulaGrade): string {
  return `${c.carrinhoNome}, ${formatarDia(c.diaSemana)}, ${formatarTurno(c.turnoId)}`;
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

/** Aplica a todos os pedidos da pessoa o que é dela: nome e marca criança/idoso. */
export function atualizarPessoa(
  celulas: CelulaGrade[],
  publicadorId: string,
  dados: Partial<Pick<PedidoGrade, "publicadorNome" | "criancaOuIdoso">>,
): CelulaGrade[] {
  return celulas.map((c) => ({
    ...c,
    publicadores: c.publicadores.map((p) => (p.publicadorId === publicadorId ? { ...p, ...dados } : p)),
  }));
}
