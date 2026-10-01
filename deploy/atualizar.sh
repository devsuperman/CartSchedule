#!/usr/bin/env bash
# Atualiza a produção para uma versão já publicada no ghcr.io. Chamado pelo
# GitHub Actions (.github/workflows/deploy.yml) a cada merge na main, mas
# também pode ser rodado à mão:
#   bash deploy/atualizar.sh <sha>     # versão específica (ex.: rollback)
#   bash deploy/atualizar.sh latest    # última build da main
# Passos: backup do banco → grava IMAGE_TAG no .env → pull → up → health check.
# Se a API não responder, volta para a tag anterior e sai com erro.
set -euo pipefail

TAG="${1:?uso: bash deploy/atualizar.sh <sha|latest>}"
if ! [[ "$TAG" =~ ^([0-9a-f]{7,40}|latest)$ ]]; then
  echo "Tag inválida: $TAG (esperado SHA do commit ou 'latest')" >&2
  exit 1
fi

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_DIR"
dc() { docker compose -f docker-compose.prod.yml "$@"; }

ANTERIOR="$(grep -E '^IMAGE_TAG=' .env 2>/dev/null | cut -d= -f2- || true)"

# Fica no .env para que comandos manuais (dc up -d, dc logs...) usem a mesma versão.
definir_tag() {
  sed -i '/^IMAGE_TAG=/d' .env
  echo "IMAGE_TAG=$1" >> .env
}

api_saudavel() {
  # A API não expõe porta; checa pelo container web (nginx:alpine tem wget).
  for _ in $(seq 1 30); do
    if dc exec -T web wget -qO /dev/null http://api:8080/health 2>/dev/null; then
      return 0
    fi
    sleep 2
  done
  return 1
}

echo "==> $(date -Is) atualizando para $TAG (anterior: ${ANTERIOR:-nenhuma})"

if [ -n "$(dc ps --status running -q db 2>/dev/null)" ]; then
  echo "==> Backup do banco antes das migrations"
  bash deploy/backup.sh
fi

definir_tag "$TAG"
dc pull api web
dc up -d --remove-orphans

if api_saudavel; then
  docker image prune -f >/dev/null
  echo "==> OK: produção em $TAG"
  exit 0
fi

echo "!! A API não respondeu em /health. Últimos logs:" >&2
dc logs --tail 50 api >&2 || true
if [ -n "$ANTERIOR" ] && [ "$ANTERIOR" != "$TAG" ]; then
  echo "!! Voltando para $ANTERIOR" >&2
  definir_tag "$ANTERIOR"
  dc up -d
fi
exit 1
