// Entrada/saída comum dos hooks: lê o JSON do stdin e resolve caminhos do projeto.
import path from "node:path";
import { execFileSync } from "node:child_process";

export async function lerEntrada() {
  let texto = "";
  for await (const parte of process.stdin) texto += parte;
  return texto ? JSON.parse(texto) : {};
}

export const raiz = process.env.CLAUDE_PROJECT_DIR || process.cwd();

export function relativo(arquivo) {
  return path.relative(raiz, path.resolve(raiz, arquivo));
}

/** Bloqueia a ação: exit 2 faz o Claude Code mostrar a mensagem ao Claude. */
export function bloquear(mensagem) {
  process.stderr.write(mensagem.trimEnd() + "\n");
  process.exit(2);
}

export function git(...args) {
  try {
    return execFileSync("git", args, { cwd: raiz, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}
