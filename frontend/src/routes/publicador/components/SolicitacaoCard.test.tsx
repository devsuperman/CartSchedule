import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { STATUS } from "../../../utils/formatacao";
import { SolicitacaoCard, type Solicitacao } from "./SolicitacaoCard";

const SOLICITACAO: Solicitacao = {
  id: 7,
  escalaMesReferencia: "2030-10-01",
  carrinhoId: 1,
  carrinhoNome: "Carrinho 01",
  carrinhoDescricao: "Praça central",
  diaSemana: 1,
  turnoId: 2,
  status: STATUS.Pendente,
  origem: 1,
};

function renderizar(props: Partial<Parameters<typeof SolicitacaoCard>[0]> = {}) {
  const onExcluir = vi.fn();
  render(
    <SolicitacaoCard
      solicitacao={SOLICITACAO}
      exclusaoPermitida
      excluindo={false}
      onExcluir={onExcluir}
      {...props}
    />,
  );
  return { onExcluir, user: userEvent.setup() };
}

describe("SolicitacaoCard — exclusão", () => {
  it("mostra o botão de excluir abaixo da descrição do carrinho, fora do destaque do dia e turno", () => {
    renderizar();

    const botao = screen.getByRole("button", { name: "Excluir pedido" });
    const descricao = screen.getByText("Praça central");
    expect(descricao.compareDocumentPosition(botao) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("08:00–10:00").parentElement).not.toContainElement(botao);
  });

  it("pede confirmação no próprio card antes de excluir", async () => {
    const { onExcluir, user } = renderizar();

    await user.click(screen.getByRole("button", { name: "Excluir pedido" }));
    expect(screen.getByText("Excluir este pedido?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.queryByText("Excluir este pedido?")).not.toBeInTheDocument();
    expect(onExcluir).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Excluir pedido" }));
    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(onExcluir).toHaveBeenCalledWith(7);
  });

  it("não mostra o botão sem exclusão permitida", () => {
    renderizar({ exclusaoPermitida: false });
    expect(screen.queryByRole("button", { name: "Excluir pedido" })).not.toBeInTheDocument();
  });

  it("não mostra o botão para pedido rejeitado", () => {
    renderizar({ solicitacao: { ...SOLICITACAO, status: STATUS.Rejeitada } });
    expect(screen.queryByRole("button", { name: "Excluir pedido" })).not.toBeInTheDocument();
  });
});
