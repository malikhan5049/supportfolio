# AGENTS.md

Binding rules for coding agents. User instruction in-session wins — say out loud when deviating.

## Repo map

- **Spring platform** (JDK 17, Gradle): `platform/identity`, `platform/shell` (Cloud Gateway), `platform/shared-spring-starter`; convention plugins in `build-logic/`.
- **Angular 22 micro-frontends** (Nx): `shell-host`, `identity-card`, `shared-ui-lib`; module federation; Playwright e2e in `platform/shell/host-e2e`.
- **Governance** — `tools/`: plain Node/Jest TS, **not** on the Nx graph.
- Specs/plans/retros: `docs/superpowers/{specs,plans,retrospectives.md}`. Read-only records.

## CI gates (source of truth — reuse exactly)

```bash
npm ci
./gradlew build && ./gradlew -p build-logic test
npx nx run-many -t lint test --projects=shared-ui-lib,shell-host,identity-card
npx nx build shell-host && npx nx build identity-card
npx nx e2e shell-host-e2e
npx prettier --check "platform/**/*.{ts,html}" "tools/**/*.ts" "eslint.config.mjs" "jest.config.ts" "jest.preset.js"
```

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

# Superpowers Framework Instructions: Dynamic Model Routing

When executing workflow phases, assess task complexity before delegating work or selecting an agent mode:

### 1. Complexity Criteria
* **TRIVIAL / MEDIUM:**
  - Isolated bug fixes, minor CRUD endpoints, CSS/UI tweaks.
  - Adding single tests, simple state updates, single-file edits.
  - **Action:** Delegate to standard agents (`brainstorm`, `plan`, `build`).

* **COMPLEX / HIGH RISK:**
  - Cross-microservice event contracts, distributed data models, auth/security.
  - Multi-module refactoring across microservices or microfrontend boundaries.
  - Concurrent data structures, transaction boundaries, performance-critical loops.
  - **Action:** Explicitly switch to deep reasoning agents (`brainstorm-deep`, `plan-deep`, `build-complex`, `reviewer-deep`).

### 2. Automatic Phase Delegation Rules
1. **Brainstorm Phase:** Evaluate requirement scope. If it involves cross-service dependencies, route internally to `brainstorm-deep`. Otherwise, use `brainstorm`.
2. **Planning Phase:** Check step dependencies. If plans touch multiple API contracts, delegate step decomposition to `plan-deep`.
3. **Build Phase:** For standard step execution, use `build`. If 2+ consecutive TDD attempts fail due to complex multi-file state issues, escalate task execution to `build-complex`.
4. **Review Phase:** Standard plans run `reviewer`. High-shape plans (auth/security/CSP/MF - retro 2026-10-20 standing item) route to `reviewer-deep` (deepseek-v4-pro, read-only).
