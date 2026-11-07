#!/usr/bin/env node
// PreToolUse (Bash) do subagente revisor-regras: ele só lê, compila e roda testes.
import { lerEntrada, bloquear } from "./lib/io.mjs";
import { trechoNaoPermitidoParaRevisor } from "./lib/regras.mjs";

const { tool_input: entrada = {} } = await lerEntrada();
const recusado = trechoNaoPermitidoParaRevisor(entrada.command ?? "");
if (recusado) {
  bloquear(
    `Bloqueado: o revisor-regras é somente leitura e não pode rodar "${recusado}".\n` +
      "Use só git diff/log/show/status, dotnet build/test, npm test/run lint/run build, npx vitest/tsc/oxlint e leitura de arquivos. Relate o problema em vez de corrigi-lo.",
  );
}
