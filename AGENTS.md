# AGENTS.md

Binding rules for coding agents. User instruction in-session wins — say out loud when deviating.

## Repo map

- **Spring platform** (JDK 17, Gradle): `platform/shell` (gateway + Angular host), `platform/identity`, `platform/shared-spring-starter`; convention plugins in `build-logic/`.
- **Angular 22 micro-frontends** (Nx, under `platform/`): `shell-host`, `tinyurl-microfrontend`, `shared-ui-lib` (`platform/shared-ui-lib`); module federation; Playwright e2e in `platform/shell/host-e2e`.
- **TinyURL project slice**: `projects/tinyurl/{service,microfrontend}`.
- **Governance** — `tools/`: plain Node/Jest TS, **not** on the Nx graph.
- Specs/plans/retros/roadmap: `docs/superpowers/{specs,plans,retrospectives.md,ROADMAP.md}`. Read-only records (amended only with dated notes when explicitly approved).

## CI gates (source of truth — reuse exactly)

```bash
npm ci
./gradlew build && ./gradlew -p build-logic test
npx nx run-many -t lint test --projects=shared-ui-lib,shell-host,tinyurl-microfrontend
npx nx build shell-host && npx nx build tinyurl-microfrontend
npx nx e2e shell-host-e2e
npx prettier --check "platform/**/*.{ts,html}" "tools/**/*.ts" "eslint.config.mjs" "jest.config.ts" "jest.preset.js"
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
- Reading `docs/superpowers/retrospectives.md` before planning is mandatory; write a `Ruling:` ledger line the moment you deviate from a standing rule.

## Env

Windows/PowerShell first (`gradlew.bat` locally, `./gradlew` in CI). Node 24, JDK 17, `npm ci` only.



## Plan retrospective (binding)

At the end of every completed plan, before reporting the plan complete:

- Add one timestamped, plan-tagged entry at the top of
  `docs/superpowers/retrospectives.md` answering: **What went well?**,
  **What would we like to continue doing?**, and **What would we like to
  stop doing?**
- Present the same three answers to the human in the completion message.
- Write the entry once, after the plan is complete; do not add mid-plan retrospective entries.