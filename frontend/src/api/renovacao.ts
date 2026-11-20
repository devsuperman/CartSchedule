import { apiFetch } from "./client";
import { iniciarSessao, obterSessao, type Papel } from "./sessao";

let renovacaoFeita = false;

/** Só para os testes: a renovação é feita uma vez por abertura do app. */
export function reiniciarRenovacaoParaTestes(): void {
  renovacaoFeita = false;
}

/**
 * Ao abrir o app, troca o token por um com a validade cheia (POST /api/sessao/renovar): quem usa
 * o site pelo menos uma vez a cada 180 dias nunca precisa digitar a senha de novo. O administrador
 * de recuperação não é publicador e não renova. Um 401 aqui já encerra a sessão (apiFetch).
 */
export function renovarUmaVez(papel: Papel): void {
  if (renovacaoFeita || papel === "recuperacao") return;
  renovacaoFeita = true;
  apiFetch<{ token: string; papel: Papel }>("/api/sessao/renovar", { method: "POST" })
    .then((renovada) => {
      // Se a pessoa saiu enquanto a renovação estava no ar, não a loga de novo.
      if (obterSessao()) iniciarSessao(renovada);
    })
    .catch(() => {
      // Sem rede ou erro do servidor: segue com o token atual.
    });
}
