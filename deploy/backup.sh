#!/usr/bin/env bash
# Gera um dump compactado do PostgreSQL em ~/backups e mantém os últimos 14.
# Se BACKUP_S3_BUCKET estiver definido no .env (e a AWS CLI configurada),
# também envia o arquivo para o S3.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DESTINO="${HOME}/backups"
ARQUIVO="${DESTINO}/cartschedule-$(date +%Y%m%d-%H%M%S).sql.gz"
mkdir -p "$DESTINO"

cd "$REPO_DIR"
docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump -U cartschedule -d cartschedule --clean --if-exists | gzip > "$ARQUIVO"
echo "$(date -Is) backup gerado: $ARQUIVO"

ls -1t "$DESTINO"/cartschedule-*.sql.gz | tail -n +15 | xargs -r rm --

BUCKET="$(grep -E '^BACKUP_S3_BUCKET=' .env 2>/dev/null | cut -d= -f2- || true)"
if [ -n "$BUCKET" ]; then
  aws s3 cp "$ARQUIVO" "s3://${BUCKET}/$(basename "$ARQUIVO")"
fi
