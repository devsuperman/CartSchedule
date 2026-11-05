import { describe, expect, it } from "vitest";
import { escalaDaImagem } from "./imagemEscala";

describe("escalaDaImagem", () => {
  it("amplia até 3x uma imagem estreita", () => {
    expect(escalaDaImagem(400, 600)).toBe(3);
  });

  it("deixa a largura final em até 1440px", () => {
    expect(escalaDaImagem(1000, 800)).toBeCloseTo(1.44);
  });

  it("não passa de 16 milhões de pixels, que é o limite do Safari do iPhone", () => {
    const escala = escalaDaImagem(1000, 10_000);

    expect(1000 * escala * 10_000 * escala).toBeLessThanOrEqual(16_000_000 + 1);
    expect(escala).toBeLessThan(1.44);
  });

  it("usa 1 quando o elemento ainda não tem tamanho", () => {
    expect(escalaDaImagem(0, 0)).toBe(1);
  });
});
