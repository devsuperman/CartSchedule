#!/usr/bin/env bash
# Tears down the QA environment started by up.sh and moves Playwright screenshots out of the repo.
set -uo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(git -C "$SKILL_DIR" rev-parse --show-toplevel)"
STATE="${QA_STATE_DIR:-/tmp/cartschedule-qa}"

if [[ -d "$ROOT/.playwright-mcp" ]]; then
  mkdir -p "$STATE/screenshots"
  find "$ROOT/.playwright-mcp" -maxdepth 1 -name '*.png' -exec mv {} "$STATE/screenshots/" \;
  rm -rf "$ROOT/.playwright-mcp"
fi

# Each process leads its own group (setsid in up.sh): kill the whole tree.
for nome in api web; do
  if [[ -f "$STATE/$nome.pid" ]]; then
    kill -- "-$(cat "$STATE/$nome.pid")" 2>/dev/null
    rm -f "$STATE/$nome.pid"
  fi
done

docker rm -f cartschedule-qa-db >/dev/null 2>&1

sleep 1
if ss -ltn | grep -qE ':(3000|5000|55432) '; then
  echo "Something is still listening on 3000, 5000 or 55432:" >&2
  ss -ltnp 2>/dev/null | grep -E ':(3000|5000|55432) ' >&2
  exit 1
fi

echo "QA environment down"
[[ -d "$STATE/screenshots" ]] && echo "  screenshots: $STATE/screenshots"
exit 0
