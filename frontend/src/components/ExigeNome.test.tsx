import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { PUBLICADOR_NOME_STORAGE_KEY } from "../api/client";
import { ExigeNome } from "./ExigeNome";

function renderizar(caminho: string) {
  render(
    <MemoryRouter initialEntries={[caminho]}>
      <Routes>
        <Route path="/nome" element={<p>Tela do nome</p>} />
        <Route path="/" element={<ExigeNome><p>Tela inicial</p></ExigeNome>} />
        <Route path="/solicitar" element={<ExigeNome><p>Wizard</p></ExigeNome>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ExigeNome", () => {
  it.each(["/", "/solicitar"])("sem nome salvo, %s leva à tela do nome", (caminho) => {
    renderizar(caminho);
    expect(screen.getByText("Tela do nome")).toBeInTheDocument();
  });

  it("com nome salvo, mostra a tela pedida", () => {
    localStorage.setItem(PUBLICADOR_NOME_STORAGE_KEY, "Ana");
    renderizar("/solicitar");
    expect(screen.getByText("Wizard")).toBeInTheDocument();
  });
});
