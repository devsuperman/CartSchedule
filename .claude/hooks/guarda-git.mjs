#!/usr/bin/env node
// PreToolUse (Bash): impede push direto para a main (que vai a produção pelo deploy.yml)
// e push --force.
import { lerEntrada, bloquear, git } from "./lib/io.mjs";
import { motivoBloqueioGit } from "./lib/regras.mjs";

const { tool_input: entrada = {} } = await lerEntrada();
const comando = entrada.command ?? "";
if (!/\bgit\b[\s\S]*\bpush\b/.test(comando)) process.exit(0);

const motivo = motivoBloqueioGit(comando, git("branch", "--show-current"));
if (motivo) bloquear(`Bloqueado pelo hook guarda-git: ${motivo}`);
