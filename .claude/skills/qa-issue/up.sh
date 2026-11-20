#!/usr/bin/env bash
# Starts a disposable QA environment: PostgreSQL (Docker, :55432), API (:5000), Vite (:3000).
# Run from anywhere inside the repo. Tear down with down.sh.
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(git -C "$SKILL_DIR" rev-parse --show-toplevel)"
STATE="${QA_STATE_DIR:-/tmp/cartschedule-qa}"
SENHA="${QA_ADMIN_SENHA:-qa-senha}"
DB=cartschedule-qa-db

for porta in 3000 5000 55432; do
  if ss -ltn | grep -q ":$porta "; then
    echo "Port $porta is already in use: stop what is using it (or run down.sh)." >&2
    exit 1
  fi
done

mkdir -p "$STATE"

echo "Starting PostgreSQL..."
docker run -d --name "$DB" -e POSTGRES_PASSWORD=qa -e POSTGRES_DB=cartschedule -p 55432:5432 postgres:16-alpine >/dev/null
until docker exec "$DB" pg_isready -U postgres -d cartschedule >/dev/null 2>&1; do sleep 1; done

if [[ ! -s "$STATE/hash-$SENHA" ]]; then
  echo "Generating the admin password hash..."
  (cd "$SKILL_DIR" && dotnet run hash.cs -- "$SENHA" > "$STATE/hash-$SENHA")
fi

echo "Starting the API..."
(
  cd "$ROOT/backend/src/CartSchedule.Api"
  ConnectionStrings__Default="Host=localhost;Port=55432;Database=cartschedule;Username=postgres;Password=qa" \
  Admin__Usuario=admin \
  Admin__SenhaHash="$(cat "$STATE/hash-$SENHA")" \
  Jwt__ChaveSecreta="chave-de-qa-local-com-pelo-menos-32-bytes" \
  Cors__FrontendOrigin=http://localhost:3000 \
  ASPNETCORE_URLS=http://localhost:5000 \
  ASPNETCORE_ENVIRONMENT=Development \
  setsid nohup dotnet run --no-launch-profile > "$STATE/api.log" 2>&1 &
  echo $! > "$STATE/api.pid"
)

echo "Starting Vite..."
(
  cd "$ROOT/frontend"
  [[ -d node_modules ]] || npm install --silent
  VITE_API_URL=http://localhost:5000 setsid nohup npm run dev -- --port 3000 --strictPort > "$STATE/web.log" 2>&1 &
  echo $! > "$STATE/web.pid"
)

for _ in $(seq 1 120); do
  if curl -sf http://localhost:5000/health >/dev/null && curl -sf http://localhost:3000 >/dev/null; then
    cat <<EOF
QA environment ready
  web:   http://localhost:3000   (log: $STATE/web.log)
  api:   http://localhost:5000   (log: $STATE/api.log)
  admin: admin / $SENHA
EOF
    exit 0
  fi
  sleep 2
done

echo "Timed out waiting for the API or Vite. Logs: $STATE/api.log, $STATE/web.log" >&2
exit 1
