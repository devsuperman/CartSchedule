import { describe, expect, it } from "vitest";
import type { CelulaGrade } from "./gradeEscala";
import { escalaParaCompartilhar } from "./escalaParaCompartilhar";

function celula(overrides: Partial<CelulaGrade>): CelulaGrade {
  return {
    carrinhoId: 1,
    carrinhoNome: "Carrinho 01",
    carrinhoDescricao: null,
    carrinhoDataEspecial: null,
    diaSemana: 3,
    turnoId: 2,
    disponivel: true,
    publicadores: [{ publicadorId: "p1", publicadorNome: "Ana", criancaOuIdoso: false } as CelulaGrade["publicadores"][number]],
    ...overrides,
  };
}

describe("escalaParaCompartilhar — rótulo do dia", () => {
  it("usa só o nome do dia no carrinho normal", () => {
    const [carrinho] = escalaParaCompartilhar([celula({})]);

    expect(carrinho.dias[0].rotulo).toBe("Quarta-feira");
  });

  it("acrescenta a data no carrinho de data especial", () => {
    const [carrinho] = escalaParaCompartilhar([celula({ carrinhoDataEspecial: "2026-10-14" })]);

    expect(carrinho.dias[0].rotulo).toBe("Quarta-feira, 14/10");
  });

  it("deixa de fora as células sem ninguém", () => {
    const resultado = escalaParaCompartilhar([celula({ publicadores: [] })]);

    expect(resultado).toEqual([]);
  });
});
