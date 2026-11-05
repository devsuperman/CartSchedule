import { describe, expect, it } from "vitest";
import type { CelulaGrade } from "./gradeEscala";
import { escalaParaCompartilhar, escalaVazia } from "./escalaParaCompartilhar";

function pessoas(...nomes: string[]): CelulaGrade["publicadores"] {
  return nomes.map((nome, i) => ({
    solicitacaoId: i + 1,
    publicadorId: nome,
    publicadorNome: nome,
    origem: 1,
    totalNaEscala: 1,
    criancaOuIdoso: false,
  }));
}

function celula(overrides: Partial<CelulaGrade>): CelulaGrade {
  return {
    carrinhoId: 1,
    carrinhoNome: "Carrinho 01",
    carrinhoDescricao: null,
    carrinhoDataEspecial: null,
    diaSemana: 3,
    turnoId: 2,
    disponivel: true,
    publicadores: pessoas("Ana"),
    ...overrides,
  };
}

const c2 = { carrinhoId: 2, carrinhoNome: "Carrinho 02" };

describe("escalaParaCompartilhar — grade do mês", () => {
  it("organiza por dia → turno, com os carrinhos nas colunas, em ordem", () => {
    const { semanal } = escalaParaCompartilhar([
      celula({ ...c2, diaSemana: 5, turnoId: 1, publicadores: pessoas("Edu") }),
      celula({ ...c2, diaSemana: 1, turnoId: 3, publicadores: pessoas("Caio") }),
      celula({ carrinhoId: 1, diaSemana: 1, turnoId: 3, publicadores: pessoas("Ana", "Bia") }),
      celula({ carrinhoId: 1, diaSemana: 1, turnoId: 2, publicadores: pessoas("Dani") }),
    ]);

    expect(semanal.carrinhos.map((c) => c.nome)).toEqual(["Carrinho 01", "Carrinho 02"]);
    expect(semanal.dias.map((d) => d.rotulo)).toEqual(["Segunda-feira", "Sexta-feira"]);
    expect(semanal.dias[0].turnos).toEqual([
      { turnoId: 2, nomes: [["Dani"], []] },
      { turnoId: 3, nomes: [["Ana", "Bia"], ["Caio"]] },
    ]);
    // Mesmas colunas em todos os dias: o carrinho 01 fica vazio na sexta, mas não muda de lugar.
    expect(semanal.dias[1].turnos).toEqual([{ turnoId: 1, nomes: [[], ["Edu"]] }]);
  });

  it("leva a descrição do carrinho, sem espaços sobrando", () => {
    const { semanal } = escalaParaCompartilhar([celula({ carrinhoDescricao: "  Em frente ao mercado " })]);

    expect(semanal.carrinhos[0].descricao).toBe("Em frente ao mercado");
  });

  it("deixa de fora vagas sem ninguém, e com elas turnos, dias e carrinhos vazios", () => {
    const escala = escalaParaCompartilhar([
      celula({ publicadores: [] }),
      celula({ ...c2, diaSemana: 2, publicadores: [] }),
    ]);

    expect(escala).toEqual({ semanal: { carrinhos: [], dias: [] }, datasEspeciais: [] });
    expect(escalaVazia(escala)).toBe(true);
  });
});

describe("escalaParaCompartilhar — datas especiais", () => {
  it("separa o carrinho de data especial da grade do mês", () => {
    const escala = escalaParaCompartilhar([
      celula({ carrinhoId: 1 }),
      celula({ carrinhoId: 9, carrinhoNome: "Evento", carrinhoDataEspecial: "2026-11-18", publicadores: pessoas("Zé") }),
    ]);

    expect(escala.semanal.carrinhos.map((c) => c.nome)).toEqual(["Carrinho 01"]);
    expect(escala.datasEspeciais).toEqual([
      {
        data: "2026-11-18",
        rotulo: "Quarta-feira, 18/11",
        carrinhos: [{ carrinhoId: 9, nome: "Evento", descricao: null }],
        turnos: [{ turnoId: 2, nomes: [["Zé"]] }],
      },
    ]);
    expect(escalaVazia(escala)).toBe(false);
  });

  it("junta os carrinhos da mesma data e ordena as datas", () => {
    const { datasEspeciais } = escalaParaCompartilhar([
      celula({ carrinhoId: 8, carrinhoNome: "B", carrinhoDataEspecial: "2026-11-25", diaSemana: 3 }),
      celula({ carrinhoId: 7, carrinhoNome: "A", carrinhoDataEspecial: "2026-11-09", diaSemana: 1 }),
      celula({ carrinhoId: 6, carrinhoNome: "C", carrinhoDataEspecial: "2026-11-09", diaSemana: 1 }),
    ]);

    expect(datasEspeciais.map((d) => d.rotulo)).toEqual(["Segunda-feira, 09/11", "Quarta-feira, 25/11"]);
    expect(datasEspeciais[0].carrinhos.map((c) => c.nome)).toEqual(["C", "A"]);
  });
});
