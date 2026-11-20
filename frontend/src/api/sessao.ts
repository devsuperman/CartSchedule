/**
 * Sessão de login (ADR 0001): o JWT do POST /api/login e o papel, guardados no localStorage para
 * durar os 180 dias do publicador (o do administrador expira em 2 h no servidor). Store simples
 * com assinatura, para a guarda ExigeLogin e o cabeçalho reagirem na hora a entrar/sair — e a um
 * 401 da API, que encerra a sessão (api/client.ts).
 */
export type Papel = "publicador" | "administrador" | "recuperacao";

export interface Sessao {
  token: string;
  papel: Papel;
}

export const SESSAO_STORAGE_KEY = "cartschedule:sessao";

function lerSessaoSalva(): Sessao | null {
  try {
    const salva = localStorage.getItem(SESSAO_STORAGE_KEY);
    if (!salva) return null;
    const sessao = JSON.parse(salva) as Partial<Sessao>;
    return typeof sessao.token === "string" && typeof sessao.papel === "string" ? (sessao as Sessao) : null;
  } catch {
    return null;
  }
}

// Inicializada direto do localStorage para o token já ir na primeira requisição da tela.
let sessaoAtual: Sessao | null = lerSessaoSalva();
const ouvintes = new Set<() => void>();

function definir(sessao: Sessao | null): void {
  sessaoAtual = sessao;
  try {
    if (sessao) {
      localStorage.setItem(SESSAO_STORAGE_KEY, JSON.stringify(sessao));
    } else {
      localStorage.removeItem(SESSAO_STORAGE_KEY);
    }
  } catch {
    // localStorage indisponível (ex: modo privado) — a sessão vale só em memória.
  }
  ouvintes.forEach((ouvinte) => ouvinte());
}

export function obterSessao(): Sessao | null {
  return sessaoAtual;
}

export function assinarSessao(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

export function iniciarSessao(sessao: Sessao): void {
  definir(sessao);
}

/** "Sair", ou token recusado pela API (expirado, senha redefinida, conta excluída). */
export function encerrarSessao(): void {
  if (sessaoAtual) definir(null);
}

/** Recarrega do localStorage — só para os testes, que limpam o armazenamento entre um e outro. */
export function recarregarSessaoParaTestes(): void {
  sessaoAtual = lerSessaoSalva();
  ouvintes.forEach((ouvinte) => ouvinte());
}

export function ehAdministrativo(papel: Papel | undefined): boolean {
  return papel === "administrador" || papel === "recuperacao";
}
