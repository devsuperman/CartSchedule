#!/usr/bin/env node
// PostToolUse (Edit|Write|MultiEdit): roda o oxlint no arquivo .ts/.tsx do frontend
// recém-editado, para o Claude ver o erro na hora em vez de esperar o CI.
import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { lerEntrada, relativo, raiz, bloquear } from "./lib/io.mjs";
import { cauda } from "./lib/regras.mjs";

const { tool_input: entrada = {} } = await lerEntrada();
if (!entrada.file_path) process.exit(0);
const arquivo = relativo(entrada.file_path);
if (!/^frontend\/src\/.*\.tsx?$/.test(arquivo)) process.exit(0);

const frontend = path.join(raiz, "frontend");
const oxlint = path.join(frontend, "node_modules", ".bin", "oxlint");
if (!existsSync(oxlint)) process.exit(0); // sem npm install ainda: o hook Stop/CI pegam depois

const r = spawnSync(oxlint, [path.relative(frontend, path.join(raiz, arquivo))], { cwd: frontend, encoding: "utf8" });
const saida = `${r.stdout ?? ""}${r.stderr ?? ""}`;
if (r.status !== 0) bloquear(`oxlint encontrou erros em ${arquivo}:\n${cauda(saida, 40)}`);
if (/\bwarning\b/i.test(saida)) {
  // Aviso não bloqueia, mas vai para o contexto do Claude.
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: `oxlint (avisos) em ${arquivo}:\n${cauda(saida, 30)}` },
  }));
}
