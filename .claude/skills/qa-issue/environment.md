# QA environment

`up.sh` and `down.sh` are the source of truth; this file holds the reasons and gotchas they don't show.

## What `up.sh` does

- **Database**: container `cartschedule-qa-db` (`postgres:16-alpine`, port 55432). The API applies migrations and seeds the shifts on startup, so the database starts empty except for the 6 shifts.
- **Admin**: a recovery admin `admin` / `qa-senha` (override with `QA_ADMIN_SENHA`). The API only accepts a `PasswordHasher` hash, so `hash.cs` generates one with `dotnet run hash.cs` (a .NET 10 file-based app, `#:package` directive). The real `.env` is never read: its admin password is unknown and must stay that way.
- **API**: `dotnet run --no-launch-profile` with the config passed as environment variables (`ConnectionStrings__Default`, `Admin__*`, `Jwt__ChaveSecreta`, `Cors__FrontendOrigin`, `ASPNETCORE_URLS`). Without `--no-launch-profile`, `launchSettings.json` would override the URL.
- **Web**: Vite on port 3000 with `--strictPort` (3000 is the API's default CORS origin) and `VITE_API_URL=http://localhost:5000`.
- **Processes**: each one starts in its own session (`setsid`); the PID file holds the group leader, so `down.sh` kills the whole tree (`dotnet run` spawns the API as a child).
- **State**: PIDs, logs (`api.log`, `web.log`) and the hash live in `$QA_STATE_DIR` (default `/tmp/cartschedule-qa`). Read the logs there when a step fails.

`up.sh` refuses to start when 3000, 5000 or 55432 is taken: a dev server or `docker compose` is already running. Stop it, or run `down.sh` if it is a leftover QA environment.

## Gotchas

- **Playwright MCP saves files only under the repo root** (`.playwright-mcp/`). Screenshots go there; `down.sh` moves them out before deleting the folder, so nothing gets committed.
- **Stop processes by PID**, which `down.sh` does. `pkill -f <pattern>` can match the shell running the command and kill it mid-cleanup.
- **The API reads the date from the real clock** here (no test clock), so the target schedule month follows today's date.
- **Rate limiting** on `/api/login` is per IP; many logins in a row from `curl` can hit it. Reuse tokens instead of logging in per call.
