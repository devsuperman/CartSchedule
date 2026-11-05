import { TURNOS } from "../../../constants/turnos";
import { formatarDataCurta, formatarDia } from "../../../utils/formatacao";
import type { CelulaGrade } from "./gradeEscala";

/** Coluna da grade: um carrinho com gente na imagem. */
export interface CarrinhoColuna {
  carrinhoId: number;
  nome: string;
  descricao: string | null;
}

/** Linha da grade: um turno; `nomes[i]` são as pessoas do carrinho `carrinhos[i]` (vazio = ninguém). */
export interface LinhaTurno {
  turnoId: number;
  nomes: string[][];
}

export interface DiaParaCompartilhar {
  dia: number;
  rotulo: string;
  turnos: LinhaTurno[];
}

/** Imagem do mês (carrinhos normais): mesmas colunas em todos os dias, para o carrinho não mudar de lugar. */
export interface EscalaSemanal {
  carrinhos: CarrinhoColuna[];
  dias: DiaParaCompartilhar[];
}

/** Uma data especial (regra 10a): os carrinhos daquela data juntos, numa imagem própria. */
export interface DataEspecialParaCompartilhar {
  /** yyyy-MM-dd */
  data: string;
  /** "Quarta-feira, 18/11" */
  rotulo: string;
  carrinhos: CarrinhoColuna[];
  turnos: LinhaTurno[];
}

export interface EscalaParaCompartilhar {
  semanal: EscalaSemanal;
  datasEspeciais: DataEspecialParaCompartilhar[];
}

const ordemTurno = (id: number) => TURNOS.findIndex((t) => t.id === id);

function colunas(celulas: CelulaGrade[]): CarrinhoColuna[] {
  const carrinhos = new Map<number, CarrinhoColuna>();
  for (const c of celulas) {
    if (!carrinhos.has(c.carrinhoId)) {
      carrinhos.set(c.carrinhoId, {
        carrinhoId: c.carrinhoId,
        nome: c.carrinhoNome,
        descricao: c.carrinhoDescricao?.trim() || null,
      });
    }
  }
  return [...carrinhos.values()].sort((a, b) => a.carrinhoId - b.carrinhoId);
}

/** Uma linha por turno com gente, com os nomes alinhados às colunas. */
function linhas(celulas: CelulaGrade[], carrinhos: CarrinhoColuna[]): LinhaTurno[] {
  const porTurno = new Map<number, LinhaTurno>();
  for (const c of celulas) {
    let linha = porTurno.get(c.turnoId);
    if (!linha) {
      linha = { turnoId: c.turnoId, nomes: carrinhos.map(() => []) };
      porTurno.set(c.turnoId, linha);
    }
    const coluna = carrinhos.findIndex((k) => k.carrinhoId === c.carrinhoId);
    linha.nomes[coluna].push(...c.publicadores.map((p) => p.publicadorNome));
  }
  return [...porTurno.values()].sort((a, b) => ordemTurno(a.turnoId) - ordemTurno(b.turnoId));
}

function agruparPor<K>(celulas: CelulaGrade[], chave: (c: CelulaGrade) => K): [K, CelulaGrade[]][] {
  const grupos = new Map<K, CelulaGrade[]>();
  for (const celula of celulas) {
    const k = chave(celula);
    grupos.set(k, [...(grupos.get(k) ?? []), celula]);
  }
  return [...grupos];
}

/**
 * Visão só leitura da escala para as imagens de compartilhamento (issue #34), na ordem em que as
 * pessoas procuram: dia → turno → carrinho. Uma grade do mês (turnos nas linhas, carrinhos nas
 * colunas) e uma por data especial. Só entra o que tem gente (turnos, dias e carrinhos vazios
 * somem) e nenhum estado de vaga — isso é só do admin (regra 3).
 */
export function escalaParaCompartilhar(celulas: CelulaGrade[]): EscalaParaCompartilhar {
  const comGente = celulas.filter((c) => c.publicadores.length > 0);
  const normais = comGente.filter((c) => !c.carrinhoDataEspecial);
  const especiais = comGente.filter((c) => c.carrinhoDataEspecial);

  const carrinhos = colunas(normais);
  const dias = agruparPor(normais, (c) => c.diaSemana)
    .sort(([a], [b]) => a - b)
    .map(([dia, doDia]) => ({ dia, rotulo: formatarDia(dia), turnos: linhas(doDia, carrinhos) }));

  const datasEspeciais = agruparPor(especiais, (c) => c.carrinhoDataEspecial!)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, daData]) => {
      const carrinhosDaData = colunas(daData);
      return {
        data,
        rotulo: `${formatarDia(daData[0].diaSemana)}, ${formatarDataCurta(data)}`,
        carrinhos: carrinhosDaData,
        turnos: linhas(daData, carrinhosDaData),
      };
    });

  return { semanal: { carrinhos, dias }, datasEspeciais };
}

/** true quando não há ninguém para compartilhar. */
export function escalaVazia(escala: EscalaParaCompartilhar): boolean {
  return escala.semanal.dias.length === 0 && escala.datasEspeciais.length === 0;
}
