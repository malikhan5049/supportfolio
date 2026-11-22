# AGENTS.md

Binding rules for coding agents. User instruction in-session wins — say out loud when deviating.

## Repo map

- **Spring platform** (JDK 17, Gradle): `platform/shell` (gateway + Angular host), `platform/identity`, `platform/shared-spring-starter`; convention plugins in `build-logic/`.
- **Angular 22 micro-frontends** (Nx, under `platform/`): `shell-host`, `tinyurl-microfrontend`, `shared-ui-lib` (`platform/shared-ui-lib`); module federation; Playwright e2e in `platform/shell/host-e2e`.
- **TinyURL project slice**: `projects/tinyurl/{service,microfrontend}`.
- **Governance** — `tools/`: plain Node/Jest TS, **not** on the Nx graph.
- Specs/plans/retros/roadmap: `docs/superpowers/{specs,plans,retrospectives.md,retro-actions.md,rulings.md,ROADMAP.md,retro/archive/}`; new plans start from `docs/superpowers/plan-template.md`. Read-only records (amended only with dated notes when explicitly approved).

## CI gates (source of truth — reuse exactly)

```bash
npm ci
./gradlew build && ./gradlew -p build-logic test
npx nx run-many -t lint test --projects=shared-ui-lib,shell-host,tinyurl-microfrontend
npx nx build shell-host && npx nx build tinyurl-microfrontend
npx nx e2e shell-host-e2e
npx prettier --check "platform/**/*.{ts,html}" "tools/**/*.ts" "eslint.config.mjs" "jest.config.ts" "jest.preset.js"
npx tsx tools/retro-validate.ts --all
npx jest --config tools/jest.config.ts --testPathPatterns retro
```

`tinyurl-ci.yml` adds: `tinyurl-backend`, `tinyurl-frontend`, `tinyurl-image`, `demo-stack`.

## Demo commands

```powershell
# Start the demo stack (core + Cloudflare Quick Tunnel)
.\scripts\demo.ps1

# Core stack only on http://localhost:18080
.\scripts\demo.ps1 -NoTunnel

# Reset (destroys the database volume)
docker compose -f docker-compose.demo.yml --profile tunnel down -v
```

## Branching (GitHub repo rules enforced)

- **Never commit directly to `main`.** GitHub repository rules reject direct pushes to `main` (remote rejected: push declined due to repository rule violations).
- Every change — no matter how small — goes on a feature branch (`feat/…`, `chore/…`, `fix/…`) and is pushed as a **pull request** targeting `main`.
- Never `git commit` while on `main`; `git switch -c <branch>` first. If commits already landed on local `main`, move them to a branch (`git switch -c <branch> && git branch -f main origin/main`) and open a PR.

## No-loop rule

Max **2 attempts** on a failing command, only with a changed hypothesis. Same error after one failed diagnosis → stop, investigate, then **report back** (command, output, ruled-out causes). Never rerun blind.

## Done ≠ tests green

Touched Angular code → run `npx nx build <project>` before closing. New runtime behavior → Playwright e2e. Integration config (gateway yaml, MF) in smallest verifiable increments.

## Do not touch

- `build/`, `dist/`, `.angular/`, `.nx/`, `node_modules/`, `platform/*/build/`
- `platform/shell/config/remote-registry.json` — runtime data hot-read by gateway
- `platform/identity/dev-key.pem` — never commit, move, or copy
- CI workflows unless the task is CI

## Hygiene

- Conventional commits (CI-enforced); PR template; prettier/eslint on the scopes above.

## Env

Windows/PowerShell first (`gradlew.bat` locally, `./gradlew` in CI). Node 24, JDK 17, `npm ci` only.



## Retrospectives and rulings (binding)

- **Plan with the brief.** Before invoking the planning skill, run `npx tsx tools/retro-brief.ts` and paste its output into the plan's `## Retrospective compliance` section (copy `docs/superpowers/plan-template.md`). Every RA/RP open on the plan date appears in the table as `applied` (naming the task that carries it) or `deferred — <reason>`; a missing ID or an empty reason fails CI.
- **Ledger every task.** During execution each plan's `## Dispatch Ledger` gains one row per task, with the optional `Lesson` column carrying what the next plan should do differently.
- **Close with one entry.** At completion add exactly one entry at the top of `docs/superpowers/retrospectives.md` — headline, previous actions reviewed, the three questions, a metrics line, one disposition per bullet, at most 3 new IDs — the heading is `## YYYY-MM-DD · Plan <N|Ad-hoc> · <slug>[ · PR #n]`, and every bullet ends with exactly one `→ <ID|context-only>` tag on the same line (a stray arrow in prose counts as a second tag and fails) — update `docs/superpowers/retro-actions.md`, then run `npx tsx tools/retro-rotate.ts` so the hot record stays at 3 entries. Write it once, after the plan is complete; do not add mid-plan entries. Present the same three answers to the human in the completion message.
- **Rulings live in `docs/superpowers/rulings.md`**, never in the retrospective record; write a `Ruling:` line the moment you deviate from a standing rule.
- **The retro header keeps its prime directive line** (`> Prime directive: judge the process, not the person.`) — never remove or reword it.