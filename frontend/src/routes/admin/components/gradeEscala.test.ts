import { describe, expect, it } from "vitest";
import { estadoDe, precisaAtencao, vagaNoMesmoHorario, type CelulaGrade } from "./gradeEscala";

const pessoa = { criancaOuIdoso: false };
const criancaOuIdoso = { criancaOuIdoso: true };

describe("estadoDe (PLANNING.md regra 1)", () => {
  it.each([
    ["vazia", []],
    ["incompleta", [pessoa]],
    ["incompleta", [criancaOuIdoso]],
    ["completa", [pessoa, pessoa]],
    ["completa", [pessoa, criancaOuIdoso]],
    ["completa", [pessoa, pessoa, criancaOuIdoso]],
    ["completa", [pessoa, criancaOuIdoso, criancaOuIdoso]],
    ["excesso", [pessoa, pessoa, pessoa]],
    ["excesso", [pessoa, pessoa, criancaOuIdoso, criancaOuIdoso]],
    ["excesso", [criancaOuIdoso, criancaOuIdoso, criancaOuIdoso, criancaOuIdoso]],
  ] as const)("%s com %j", (esperado, pessoas) => {
    expect(estadoDe([...pessoas])).toBe(esperado);
  });

  it("só vaga com 1 pessoa ou com excesso pede atenção", () => {
    expect(precisaAtencao("vazia")).toBe(false);
    expect(precisaAtencao("incompleta")).toBe(true);
    expect(precisaAtencao("completa")).toBe(false);
    expect(precisaAtencao("excesso")).toBe(true);
  });
});

describe("vagaNoMesmoHorario (PLANNING.md regras 10 e 10a)", () => {
  const ana = {
    solicitacaoId: 1,
    publicadorId: "ana",
    publicadorNome: "Ana",
    origem: 1,
    totalNaEscala: 1,
    criancaOuIdoso: false,
  };

  function celula(carrinhoId: number, carrinhoDataEspecial: string | null, publicadores = [ana]): CelulaGrade {
    return {
      carrinhoId,
      carrinhoNome: `Carrinho ${carrinhoId}`,
      carrinhoDataEspecial,
      diaSemana: 1,
      turnoId: 2,
      disponivel: true,
      publicadores,
    };
  }

  const ehAna = (p: { publicadorId: string }) => p.publicadorId === "ana";

  it("avisa quando a pessoa já está em outro carrinho normal no mesmo horário", () => {
    const ondeEsta = celula(1, null);
    const destino = celula(2, null, []);
    expect(vagaNoMesmoHorario([ondeEsta, destino], destino, ehAna)).toBe(ondeEsta);
  });

  it("carrinho de data especial não conflita com os normais", () => {
    const normal = celula(1, null);
    const evento = celula(2, "2026-10-05", []);
    expect(vagaNoMesmoHorario([normal, evento], evento, ehAna)).toBeNull();
  });

  it("dois carrinhos especiais da mesma data conflitam", () => {
    const eventoA = celula(1, "2026-10-05");
    const eventoB = celula(2, "2026-10-05", []);
    expect(vagaNoMesmoHorario([eventoA, eventoB], eventoB, ehAna)).toBe(eventoA);
  });
});
