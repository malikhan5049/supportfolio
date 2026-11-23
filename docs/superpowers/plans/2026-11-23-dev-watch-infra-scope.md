# Dev watch scope: shell starts infrastructure only + offline catalog tile

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Date:** 2026-11-23
**Branch:** feat/dev-watch-infra-scope
**Goal:** `watch shell` / `build-watch:shell` starts only shell BE+FE plus the infrastructure it actually depends on (identity, telemetry) — never other projects' services — and the shell catalog shows a registered-but-down remote as an offline tile.
**Spec:** docs/superpowers/specs/2026-11-22-dev-watch-scope-design.md

## Global Constraints

- Windows/PowerShell first; `gradlew.bat` locally, `./gradlew` in CI. Node 24, JDK 17, `npm ci` only. RA-001 fallback: no bash/superpowers shell scripts are used by this plan — every command below is `npx`/`tsx` and runs natively in PowerShell.
- The registry architecture is settled by the spec: **do not modify** `tools/dev-orchestrator/registry.ts`, the gateway registry endpoint, or CSP wiring.
- Never touch: `platform/shell/config/remote-registry.json` (committed, read-only runtime data), `build/`, `dist/`, `node_modules/`, CI workflows.
- Conventional commits; every change ships as a pull request — never commit to `main`.
- Historical plans, specs, and retrospectives are read-only records (amended only with a dated note when explicitly approved).
- Verification commands (copy verbatim from AGENTS.md CI gates):
  - `npx jest --config tools/jest.config.ts`
  - `npx nx run-many -t lint test --projects=shared-ui-lib,shell-host,tinyurl-microfrontend`
  - `npx nx build shell-host`
  - `npx nx e2e shell-host-e2e` (not in Task 1/2 local loops; required before PR)
  - `npx tsx tools/retro-validate.ts --all`
- Facts pinned by recon (do not re-derive): identity has **no** `databases` field and no `spring.datasource` in dev config → postgres enters the shell plan **only** via tinyurl's `databases: [postgres]`; `closure.ts:24-27` expands `dependsOn` + `databases`.

## Retrospective compliance

Brief run: 2026-11-23 (`npx tsx tools/retro-brief.ts`)

| ID | Kind | Disposition | Where |
|---|---|---|---|
| RP-001 | practice | applied | Recon (manifests, closure.ts, remote-card-host, specs) completed via explore dispatches before this plan was drafted |
| RP-002 | practice | deferred — not a high-shape service/auth/CI change (manifest YAML + one Angular component) | — |
| RP-003 | practice | applied | Task 3: Playwright e2e for the offline tile; `npx nx build shell-host` before PR |
| RP-007 | practice | deferred — no enforcement content gated by this change | — |
| RP-008 | practice | applied | Global Constraints copies CI verification commands verbatim |
| RA-001 | action | applied | No bash scripts chosen; PowerShell-native `npx` commands only (Global Constraints) |
| RA-002 | action | deferred — no image changes in this plan | — |
| RA-007 | action | deferred — CI workflow edits out of scope (AGENTS.md "Do not touch") | — |
| RA-008 | action | deferred — parked-findings triage is not this plan's goal | — |
| RA-009 | action | deferred — dated note 2026-11-23 (retro closure): registered by this plan's retrospective; not open when the brief ran | — |
| RA-010 | action | deferred — dated note 2026-11-23 (retro closure): registered by this plan's retrospective; not open when the brief ran | — |

## Review Focus

- Typo'd/invalid YAML in the edited `dependsOn` → the orchestrator must fail loudly at `loadProjectManifests` validation, not silently start a partial plan. Pinned by existing `manifests.spec.ts` validation tests (Task 1, Step 4).
- Registry still lists tinyurl after Task 1 (inputs are all manifests, not the plan) → the catalog must show tinyurl as the Task 2 offline tile, not make it vanish. Pinned by `registry.spec.ts` (keys === committed registry) + Task 3 e2e.
- CSP trusted origins must still include `http://localhost:4201` in dev when tinyurl is out of the shell plan (comes from manifests, not the plan). Pinned by `plan.spec.ts:292`-related env assertions (Task 1).
- Registry endpoint itself down → `RegistryUnavailableError` path from `CatalogService` must keep working unchanged (distinct from a single dead remote). Pinned by existing `catalog.service` specs (Task 2 must not regress them).
- Dead-port e2e fixture entry must not break the live-remote e2e (`dynamic-remote.spec.ts`) — Task 3 Step 3 runs the full e2e suite, not just the new spec.

## Tasks

### Task 1: Point the shell plan at infrastructure only

**Files:**
- Modify: `platform/project.manifest.yaml:31` (`dependsOn: [identity, tinyurl, telemetry]` → `[identity, telemetry]`)
- Modify: `tools/dev-orchestrator/manifests.spec.ts:146` (asserts shell `dependsOn`)
- Modify: `tools/dev-orchestrator/closure.spec.ts:37,68-71,78-81,122` (shell fixture + `resolveOrder('shell', …)` expectations)
- Modify: `tools/dev-orchestrator/ports.spec.ts:48,56` (shell `dependsOn` fixture + expected order `['identity','postgres','tinyurl','telemetry','shell']`)
- Modify: `tools/dev-orchestrator/plan.spec.ts:40,51,65,254` (shell-plan/watch expectations built from `[tinyurl, shellApp]` — drop tinyurl entries)

**Interfaces:**
- Consumes: `resolveOrder(appId, manifests, platform)` in `tools/dev-orchestrator/closure.ts` (unchanged).
- Produces: resolved shell plan = identity (gradle, 8081) + telemetry (compose profile observability) + shell (gradle, 8080) + shell-host dev server (4200) + compile watcher. Postgres and both tinyurl processes must be absent from the shell plan; the tinyurl app plan (`dev-orchestrator.spec.ts:330` → `['tinyurl']` closure) must be unchanged.

- [ ] **Step 1: Update the tooling specs to the target state** — in the five spec files above, change every assertion about the *shell* plan/dependsOn to exclude `tinyurl` (and consequently `postgres`). Concretely: `manifests.spec.ts` → `['identity', 'telemetry']`; `ports.spec.ts:56` → `['identity', 'telemetry', 'shell']`; `closure.spec.ts`/`plan.spec.ts` → remove tinyurl (and its service:classes/gradle module) from the shell-plan inputs and expectations. Do not touch assertions about the *tinyurl* app plan.
- [ ] **Step 2: Run them, expect FAIL** — `npx jest --config tools/jest.config.ts` → failures only in the specs you just edited (they still read `dependsOn: [identity, tinyurl, telemetry]`).
- [ ] **Step 3: Edit the manifest** — `platform/project.manifest.yaml:31` → `dependsOn: [identity, telemetry]`. Leave tinyurl's own `projects/tinyurl/project.manifest.yaml` untouched.
- [ ] **Step 4: Verify** — `npx jest --config tools/jest.config.ts` → all PASS. Then `npx tsx tools/dev-orchestrator.ts plan shell` → JSON contains no `tinyurl` process, no `postgres`; `npx tsx tools/dev-orchestrator.ts plan tinyurl` → unchanged (identity, postgres, tinyurl service+frontend, compile).
- [ ] **Step 5: Commit** — `git add platform/project.manifest.yaml tools/dev-orchestrator && git commit -m "feat(dev-orchestrator): scope shell watch plan to infrastructure only"`

### Task 2: Render an offline tile when a registered remote is down

**Files:**
- Modify: `platform/shell/host/src/app/catalog/remote-card-host.component.ts` (fallback path in `ngOnInit` try/catch, lines ~61-71, and template)
- Modify: `platform/shell/host/src/app/catalog/remote-card-host.component.html` (or wherever the fallback `CardComponent` is rendered)
- Test: `platform/shell/host/src/app/catalog/remote-card-host.component.spec.ts`

**Interfaces:**
- Consumes: `RemoteRegistryService.resolveModule(projectId, moduleName)` (rejects on missing entry) and `ref.load()` → `loadFederatedCard` (rejects when the remoteEntry is unreachable, `federated-loader.ts:19-21`). Registry-endpoint-down already surfaces separately as `RegistryUnavailableError` via `CatalogService` — do not change that path.
- Produces: offline fallback tile with `data-testid="remote-card-offline"` in the DOM when `resolveModule` or `load()` rejects. The existing generic fallback test (`'falls back to the shared card when the remote cannot be loaded'`) is superseded by the offline variant.

- [ ] **Step 1: Write the failing test** — add to `remote-card-host.component.spec.ts`, in the existing style (Jest + `@testing-library/angular`, mirror `fakeRegistryRejecting` usage at lines ~79-90): when the registry/loader rejects, the rendered DOM contains `[data-testid="remote-card-offline"]` and does **not** contain the project's Open button (`a`/`button` navigativing to `openUrl`). Keep the existing fallback test but assert the new testid instead of the absence assertion.
- [ ] **Step 2: Run it, expect FAIL** — `npx nx test shell-host` → new test fails (fallback renders without the offline marker).
- [ ] **Step 3: Implement** — in the `ngOnInit` catch (lines ~61-71), set a `offline = true` component flag; template renders the offline state (shared card visual with an explicit "Offline" label/badge, `data-testid="remote-card-offline"`, no open action) when set. Presentational only; no retries, no probing.
- [ ] **Step 4: Verify** — `npx nx test shell-host` → PASS.
- [ ] **Step 5: Commit** — `git add platform/shell/host/src/app/catalog && git commit -m "feat(catalog): show offline tile when a registered remote is down"`

### Task 3: E2E for the offline tile + integrated verification

**Files:**
- Modify: the e2e registry fixture backing `/e2e/remote-registry.json` (see `platform/shell/host-e2e/playwright.config.ts:11` and `host/src/environments/environment.e2e.ts:5` — follow the existing fixture mechanism)
- Create: `platform/shell/host-e2e/src/offline-remote.spec.ts`

**Interfaces:**
- Consumes: Task 2's `data-testid="remote-card-offline"`; the fixture pattern proven by `dynamic-remote.spec.ts:3-8`.
- Produces: one browser e2e proving new runtime behavior (RP-003).

- [ ] **Step 1: Add a fixture entry** — to the e2e remote-registry fixture, add a project whose `remoteEntry` points at a guaranteed-dead localhost port (e.g. `http://localhost:49999/remoteEntry.js`), otherwise shaped like the existing tinyurl entry.
- [ ] **Step 2: Write the failing e2e** — `offline-remote.spec.ts`: load the catalog, expect the offline tile for the dead project (`[data-testid="remote-card-offline"]`) to be visible while the live tinyurl card still renders (`remote-card-tinyurl`).
- [ ] **Step 3: Run it, expect PASS after Task 2** — `npx nx e2e shell-host-e2e`. If it fails on the fixture shape, correct the fixture to match what `toRemoteProject`/`toRemoteModuleEntries` actually consume (shared-ui-lib registry fetcher), not the other way around.
- [ ] **Step 4: Full verification before PR** — run, all must pass:
  - `npx jest --config tools/jest.config.ts`
  - `npx nx run-many -t lint test --projects=shared-ui-lib,shell-host,tinyurl-microfrontend`
  - `npx nx build shell-host`
  - `npx nx e2e shell-host-e2e`
  - `npx prettier --check "platform/**/*.{ts,html}" "tools/**/*.ts"`
  - `npx tsx tools/retro-validate.ts --all`
- [ ] **Step 5: Commit** — `git add platform/shell/host-e2e && git commit -m "test(catalog-e2e): cover offline tile for a dead remote entry"`
- [ ] **Step 6: Push and open the PR** — `git push -u origin feat/dev-watch-infra-scope`, PR targeting `main` (GitHub rules reject direct pushes to `main`).

## Dispatch Ledger

One row per task, added as the task completes. `Lesson` is optional: one sentence on what the next plan should do differently.

| Task | Status | Notes | Lesson |
|---|---|---|---|
| 1 | done | <commit, deviation> | <one-line lesson> |
| 2 | done | <commit, deviation> | — |
