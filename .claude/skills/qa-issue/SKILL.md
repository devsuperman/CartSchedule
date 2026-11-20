---
name: qa-issue
description: Acceptance QA of a GitHub issue in a disposable local environment, driven through the browser with Playwright MCP.
disable-model-invocation: true
argument-hint: <issue number>
---

# QA an issue

Verify, as a user would, that the running app delivers every **acceptance criterion** of the issue. This is acceptance QA, on top of the automated suites (`dotnet test`, `npm test`): every verdict comes with **evidence** (a snapshot line, a screenshot, an HTTP status). The environment is **disposable**: its own database, its own throwaway admin, torn down at the end.

Work in English. The app UI and the domain words (Publicador, Escala, vaga, PIN…) stay in Portuguese; quote them as they appear.

## 1. Read the spec

```bash
gh issue view <N> --json title,body,labels,comments   # plain `gh issue view` fails on this repo
```

Read the parent issue too when the body links one (`## Parent`), plus the matching rules in `docs/PLANNING.md` (source of truth).

**Done when** every acceptance criterion is rewritten as one line: *scenario → observable expected result*.

## 2. Plan the checks

For each line, pick where the result is observable:

- **Browser** (Playwright MCP): screens, flows, what the user sees and taps.
- **API** (`curl`): status codes and `codigo` values (400/403/404/409), rules with no screen.

Then list the **seed data** the scenarios need (accounts, carts, shifts, requests) and the expected numbers it should produce. Endpoints are in `docs/TECHNICAL_SPEC.md`.

**Done when** the user approves the plan (scenarios + seed + expected results). Ask once, then go.

## 3. Bring the environment up

```bash
.claude/skills/qa-issue/up.sh        # run from the repo root, in the branch under test
```

It starts PostgreSQL in Docker (port 55432), the API (:5000) and Vite (:3000), with a recovery admin `admin` / `qa-senha`. Details and gotchas: [`environment.md`](environment.md).

**Done when** the script prints `QA environment ready`.

## 4. Seed

Seed through the API with `curl`, as the admin:

```bash
T=$(curl -s localhost:5000/api/login -H 'Content-Type: application/json' \
  -d '{"usuario":"admin","pin":"qa-senha"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')
# then: -H "Authorization: Bearer $T" on every admin call
```

Keep the ids and PINs the responses return; you need them to log in as publicadores. Requests go into the **target schedule month**: day ≥ 15 → next month, day 1–14 → current month (PLANNING.md, janela de envio).

**Done when** the seed matches the plan (verify with a `GET`, e.g. the month's `/grade`).

## 5. Run the checks

Browser, at phone size first (the app is used by touch on phones):

- `browser_resize` 390×844, then log in through `/login` like a user.
- Act on refs from `browser_snapshot`; target by role when refs go stale (`role=button[name="Unir"]`).
- Take a screenshot for every visual verdict. Filenames must be under the repo: use `.playwright-mcp/<name>.png`.
- Check `browser_console_messages` (level `error`) once per screen.

Run the API-only lines with `curl` and keep the status and body.

**Done when** every line of the plan has ✅ or ❌ with its evidence. A ❌ gets a minimal repro, then QA continues with the next line.

## 6. Tear down

```bash
.claude/skills/qa-issue/down.sh
```

It moves screenshots to `$QA_STATE_DIR/screenshots` (default `/tmp/cartschedule-qa/screenshots`), deletes `.playwright-mcp/`, stops the processes and removes the container. Close the browser first (`browser_close`).

**Done when** the script prints `QA environment down`, ports 3000/5000/55432 are free and `git status` is clean.

## 7. Report

A table `Check | Result` with one row per plan line, followed by the bugs found (repro + expected vs actual) and the full screenshot paths. Then offer to post it as a comment on the PR (`gh pr comment`); post only if the user says yes.
