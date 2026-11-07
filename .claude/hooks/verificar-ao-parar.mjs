#!/usr/bin/env node
// Stop: antes de o Claude encerrar a resposta, compila e roda os testes relacionados ao
// que mudou na branch. Se falhar, exit 2 faz o Claude continuar trabalhando para corrigir.
//
// - Frontend: `vitest related` nos arquivos alterados + `tsc -b` (tipos).
// - Backend: `dotnet build` (a suíte completa precisa de Docker e é lenta: fica com o
//   revisor-regras e o CI).
// - Só roda de novo se o conteúdo mudou desde a última verificação que passou.
// - Depois de 3 bloqueios seguidos libera, avisando o usuário (evita laço infinito).
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { lerEntrada, raiz, git, bloquear } from "./lib/io.mjs";
import { classificarAlterados, cauda } from "./lib/regras.mjs";

const MAX_BLOQUEIOS = 3;
const { session_id: sessao = "sem-sessao" } = await lerEntrada();
const estadoArq = path.join(os.tmpdir(), `cartschedule-stop-${sessao}.json`);
const estado = existsSync(estadoArq) ? JSON.parse(readFileSync(estadoArq, "utf8")) : {};
const salvar = (novo) => writeFileSync(estadoArq, JSON.stringify(novo));

const base = git("merge-base", "HEAD", "origin/main") || "HEAD";
const naoRastreados = git("ls-files", "--others", "--exclude-standard").split("\n").filter(Boolean);
const alterados = [...new Set([...git("diff", "--name-only", base).split("\n"), ...naoRastreados])].filter(
  (f) => f && existsSync(path.join(raiz, f)),
);
const { frontend, backend } = classificarAlterados(alterados);
if (frontend.length === 0 && backend.length === 0) process.exit(0);

const impressao = createHash("sha256")
  .update(git("diff", base))
  .update(naoRastreados.map((f) => (existsSync(path.join(raiz, f)) ? readFileSync(path.join(raiz, f)) : "")).join("\0"))
  .digest("hex");
if (estado.passou === impressao) process.exit(0);

const falhas = [];
const avisos = [];
const rodar = (titulo, cmd, args, cwd) => {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.error || r.status !== 0) falhas.push(`### ${titulo} falhou\n${cauda(`${r.stdout ?? ""}${r.stderr ?? ""}${r.error ?? ""}`)}`);
};

if (frontend.length > 0) {
  const dir = path.join(raiz, "frontend");
  const bin = (n) => path.join(dir, "node_modules", ".bin", n);
  if (!existsSync(bin("vitest"))) {
    avisos.push("frontend sem node_modules: testes do frontend pulados (rode npm install em frontend/).");
  } else {
    rodar("tsc -b (tipos do frontend)", bin("tsc"), ["-b"], dir);
    const relativos = frontend.map((f) => path.relative("frontend", f));
    rodar("vitest related", bin("vitest"), ["related", "--run", "--passWithNoTests", ...relativos], dir);
  }
}

if (backend.length > 0) {
  const dir = path.join(raiz, "backend");
  // `dotnet --version` falha se não houver dotnet ou se faltar o SDK do .NET 10.
  const versao = spawnSync("dotnet", ["--version"], { cwd: dir, encoding: "utf8" });
  if (versao.error || versao.status !== 0 || !versao.stdout.startsWith("10.")) {
    avisos.push("SDK do .NET 10 não encontrado: build do backend pulado (o CI e o revisor-regras cobrem).");
  } else {
    rodar("dotnet build", "dotnet", ["build", "CartSchedule.Api.slnx", "-nologo", "-v", "q", "-clp:ErrorsOnly"], dir);
  }
}

const mensagemAvisos = avisos.length ? `Hook verificar-ao-parar: ${avisos.join(" ")}` : undefined;

if (falhas.length === 0) {
  salvar({ passou: impressao, bloqueios: 0 });
  if (mensagemAvisos) process.stdout.write(JSON.stringify({ systemMessage: mensagemAvisos }));
  process.exit(0);
}

const bloqueios = (estado.bloqueios ?? 0) + 1;
if (bloqueios > MAX_BLOQUEIOS) {
  rmSync(estadoArq, { force: true });
  process.stdout.write(JSON.stringify({
    systemMessage: `Hook verificar-ao-parar: build/testes ainda falhando depois de ${MAX_BLOQUEIOS} tentativas — liberei para você decidir.`,
  }));
  process.exit(0);
}
salvar({ bloqueios });
bloquear(
  `Hook verificar-ao-parar (tentativa ${bloqueios}/${MAX_BLOQUEIOS}): build/testes falharam nos arquivos alterados. ` +
    `Corrija antes de encerrar (não pule nem desative testes).\n\n${falhas.join("\n\n")}`,
);
