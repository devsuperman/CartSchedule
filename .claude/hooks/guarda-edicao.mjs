#!/usr/bin/env node
// PreToolUse (Edit|Write|MultiEdit): impede gravar segredos e termos que quebram regras
// de negócio fixas (Sábado/Domingo, status de aprovação) em código de produção.
import { lerEntrada, relativo, bloquear } from "./lib/io.mjs";
import { ehArquivoDeSegredo, ehCodigoVigiado, violacoes } from "./lib/regras.mjs";

const { tool_input: entrada = {} } = await lerEntrada();
if (!entrada.file_path) process.exit(0);
const arquivo = relativo(entrada.file_path);

if (ehArquivoDeSegredo(arquivo)) {
  bloquear(
    `Bloqueado pelo hook guarda-edicao: ${arquivo} guarda segredos (POSTGRES_PASSWORD, ADMIN_SENHA_HASH, JWT...).\n` +
      "Não edite o .env pelo Claude. Se precisar de uma variável nova, documente-a no .env.example e peça ao usuário para preenchê-la.",
  );
}

if (!ehCodigoVigiado(arquivo)) process.exit(0);

const trechos = entrada.edits // MultiEdit
  ? entrada.edits.map((e) => [e.new_string ?? "", e.old_string ?? ""])
  : [[entrada.new_string ?? entrada.content ?? "", entrada.old_string ?? ""]];

const achadas = trechos.flatMap(([novo, antigo]) => violacoes(novo, antigo));
if (achadas.length > 0) {
  const lista = achadas.map((a) => `  - "${a.linha}"\n    ${a.regra}`).join("\n");
  bloquear(
    `Bloqueado pelo hook guarda-edicao em ${arquivo}:\n${lista}\n` +
      "Estas regras são intencionais (PLANNING.md / .claude/CLAUDE.md). Se a tarefa realmente exige mudá-las, pare e pergunte ao usuário.",
  );
}
