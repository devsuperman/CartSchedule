import { describe, expect, it } from "vitest";
import { estadoDe, precisaAtencao } from "./gradeEscala";

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
