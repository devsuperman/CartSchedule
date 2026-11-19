// Lógica pura dos hooks do Claude Code (sem I/O), testada em ../test/.
// Os scripts em .claude/hooks/*.mjs só leem o JSON do stdin e chamam estas funções.

import path from "node:path";

/**
 * Termos que nunca podem aparecer em código de produção (CLAUDE.md, regras 1 e 7a).
 * Inglês (DayOfWeek.Saturday/Sunday) fica de fora de propósito: é legítimo usá-lo
 * para PULAR fim de semana ao percorrer as datas do mês.
 */
export const TERMOS_PROIBIDOS = [
  {
    regex: /\b(s[áa]bados?|domingos?)\b/i,
    regra: "Regra 1: só Segunda a Sexta — nunca Sábado/Domingo em enum, validação, UI ou seed.",
  },
  {
    regex: /\b(pendentes?|aprovad[ao]s?|rejeitad[ao]s?|StatusSolicitacao)\b/i,
    regra: "Regra 7a: sem aprovação nem status — toda Solicitacao já conta na escala; tirar alguém é excluir.",
  },
];

/** Pastas de código de produção vigiadas pelo guarda (testes e migrations ficam de fora). */
export function ehCodigoVigiado(relPath) {
  const p = relPath.split(path.sep).join("/");
  if (!/^(backend\/src|frontend\/src)\//.test(p)) return false;
  if (!/\.(cs|ts|tsx)$/.test(p)) return false;
  if (/\/Infrastructure\/Migrations\//.test(p)) return false; // histórico gerado pelo EF
  if (/\.test\.tsx?$/.test(p)) return false; // testes podem afirmar que "Sábado" NÃO aparece
  if (/^frontend\/src\/test\//.test(p)) return false;
  return true;
}

/** Remove comentários de uma linha: linhas só de comentário e o trecho após " //". */
export function semComentario(linha) {
  const t = linha.trim();
  if (t.startsWith("//") || t.startsWith("/*") || t.startsWith("*")) return "";
  return linha.replace(/(^|\s)\/\/.*$/, "$1");
}

/**
 * Linhas novas (presentes em `novo` e não em `antigo`) que trazem termo proibido.
 * Comparar com o texto antigo evita bloquear uma edição que só mexe ao redor de algo
 * que já existia.
 */
export function violacoes(novo, antigo = "") {
  const antigas = new Set(antigo.split("\n").map((l) => l.trim()));
  const achadas = [];
  for (const linha of novo.split("\n")) {
    if (antigas.has(linha.trim())) continue;
    const codigo = semComentario(linha);
    for (const termo of TERMOS_PROIBIDOS) {
      if (termo.regex.test(codigo)) achadas.push({ linha: linha.trim(), regra: termo.regra });
    }
  }
  return achadas;
}

/** `.env` e variações (.env.local, prod.env...) — exceto o `.env.example`, que é commitado. */
export function ehArquivoDeSegredo(relPath) {
  const nome = path.basename(relPath);
  if (nome === ".env.example") return false;
  return nome === ".env" || nome.startsWith(".env.") || nome.endsWith(".env");
}

/** Trechos (ex.: `git push`) de um comando composto com &&, ||, ; ou |. */
function segmentos(comando) {
  return comando.split(/&&|\|\||;|\||\n/).map((s) => s.trim()).filter(Boolean);
}

/**
 * Motivo para bloquear um comando git, ou null se pode rodar.
 * `branchAtual` é usada quando o `git push` não diz o destino.
 */
export function motivoBloqueioGit(comando, branchAtual = "") {
  for (const seg of segmentos(comando)) {
    const tokens = seg.split(/\s+/);
    const iGit = tokens.indexOf("git");
    if (iGit === -1) continue;
    const iPush = tokens.indexOf("push", iGit);
    if (iPush === -1) continue;

    const args = tokens.slice(iPush + 1);
    const forca = (a) => a === "--force" || /^-[a-zA-Z]*f[a-zA-Z]*$/.test(a) || /^\+[^-]/.test(a);
    if (args.some(forca)) {
      return "push --force reescreve o histórico remoto. Use --force-with-lease só na sua própria branch, se precisar.";
    }
    if (args.some((a) => a === "--mirror" || a === "--all" || a === "--delete" || a === "-d")) {
      return "push --mirror/--all/--delete mexe em várias branches ou apaga branch remota.";
    }

    const posicionais = args.filter((a) => !a.startsWith("-"));
    const refspecs = posicionais.slice(1); // o 1º é o remote
    const destinoMain = /^\+?(?:[^:]*:)?(?:refs\/heads\/)?(main|master)$/;
    if (refspecs.some((r) => destinoMain.test(r))) {
      return "push direto para a main dispara o deploy em produção (deploy.yml). Trabalhe numa branch e abra um PR.";
    }
    const naMain = branchAtual === "main" || branchAtual === "master";
    if (naMain && (refspecs.length === 0 || refspecs.includes("HEAD"))) {
      return "você está na main: este push iria direto para produção. Crie uma branch e abra um PR.";
    }
  }
  return null;
}

/** Arquivos alterados agrupados pelo que o hook Stop precisa checar. */
export function classificarAlterados(arquivos) {
  const frontend = arquivos.filter((f) => /^frontend\/src\/.*\.(ts|tsx|css)$/.test(f) || /^frontend\/[^/]+\.(json|ts)$/.test(f));
  const backend = arquivos.filter((f) => /^backend\/.*\.(cs|csproj|slnx|json)$/.test(f));
  return { frontend, backend };
}

/** Últimas `n` linhas de uma saída longa (o Claude não precisa de 2 mil linhas de log). */
export function cauda(texto, n = 60) {
  const linhas = texto.trimEnd().split("\n");
  return linhas.length <= n ? linhas.join("\n") : ["…", ...linhas.slice(-n)].join("\n");
}
