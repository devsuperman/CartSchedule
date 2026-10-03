import { DIAS_SEMANA } from "../../../constants/diasSemana";
import { TURNOS } from "../../../constants/turnos";
import type { CelulaGrade } from "./gradeEscala";

export interface TurnoParaCompartilhar {
  turnoId: number;
  nomes: string[];
}

export interface DiaParaCompartilhar {
  dia: number;
  rotulo: string;
  turnos: TurnoParaCompartilhar[];
}

export interface CarrinhoParaCompartilhar {
  carrinhoId: number;
  nome: string;
  descricao: string | null;
  dias: DiaParaCompartilhar[];
}

/**
 * Visão só leitura da escala para a imagem de compartilhamento: um item por carrinho, só com
 * os dias e turnos que têm gente (vagas vazias, dias vazios e carrinhos sem ninguém somem).
 * Não carrega nenhum estado de vaga (meta, excesso) — isso é só do admin (regra 3).
 */
export function escalaParaCompartilhar(celulas: CelulaGrade[]): CarrinhoParaCompartilhar[] {
  const carrinhos = new Map<number, CarrinhoParaCompartilhar>();

  for (const celula of celulas) {
    if (celula.publicadores.length === 0) continue;
    let carrinho = carrinhos.get(celula.carrinhoId);
    if (!carrinho) {
      carrinho = {
        carrinhoId: celula.carrinhoId,
        nome: celula.carrinhoNome,
        descricao: celula.carrinhoDescricao?.trim() || null,
        dias: [],
      };
      carrinhos.set(celula.carrinhoId, carrinho);
    }
    let dia = carrinho.dias.find((d) => d.dia === celula.diaSemana);
    if (!dia) {
      const rotulo = DIAS_SEMANA.find((d) => d.valor === celula.diaSemana)?.label ?? `Dia ${celula.diaSemana}`;
      dia = { dia: celula.diaSemana, rotulo, turnos: [] };
      carrinho.dias.push(dia);
    }
    dia.turnos.push({ turnoId: celula.turnoId, nomes: celula.publicadores.map((p) => p.publicadorNome) });
  }

  const ordemTurno = (id: number) => TURNOS.findIndex((t) => t.id === id);
  return [...carrinhos.values()]
    .sort((a, b) => a.carrinhoId - b.carrinhoId)
    .map((c) => ({
      ...c,
      dias: c.dias
        .sort((a, b) => a.dia - b.dia)
        .map((d) => ({ ...d, turnos: d.turnos.sort((a, b) => ordemTurno(a.turnoId) - ordemTurno(b.turnoId)) })),
    }));
}
