#!/bin/bash
# SessionStart (só em sessões na nuvem): instala as dependências do frontend para o
# lint, os testes e os hooks funcionarem. Só reinstala se package.json/lock mudaram.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}/frontend"

hashes=node_modules/.session-start.sha256
if ! sha256sum --check --status "$hashes" 2>/dev/null; then
  rm -f "$hashes"
  npm install --no-audit --no-fund
  sha256sum ../.claude/hooks/session-start.sh package.json package-lock.json > "$hashes" || rm -f "$hashes"
fi
