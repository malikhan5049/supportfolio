# Retrospectives

> Prime directive: judge the process, not the person.

**How to use this file:**

- After every plan completes, append an entry at the TOP (newest first) answering three questions:
  **What went well?** / **What would we like to continue doing?** / **What would we like to stop doing?**
- Every entry is headed `## YYYY-MM-DD · Plan <N|Ad-hoc> · <slug>` (optionally `· PR #<n>`), carries
  one `**Headline:**` line, and ends every bullet with exactly one disposition tag (`→ RP-nnn`,
  `→ RA-nnn`, or `→ context-only`) taken from `retro-actions.md`.
- Every entry carries a `### Metrics` line; entries migrated on 2026-11-22 say `metrics: not recorded`.
- Rulings for this period: see `docs/superpowers/rulings.md`.
- **Before writing any new plan, read this file from the top and apply every standing item to the
  plan: contradicted practices must not be repeated; pending improvements should be folded into the
  task list or explicitly deferred with a reason.** If a task contradicts a standing item, wait —
  the plan must either comply or record a justification next to the ledger entry.

---

## 2026-11-20 · Plan 6 · telemetry

**Headline:** Recon-before-design plus a builder check caught the plan's one real contradiction before any task existed.
**migrated:** true

### What went well?

- Recon-before-design plus a builder check caught the plan's one real contradiction (a management port also moves health, breaking every `--wait` probe) before any task existed, and the narrowed scope (human dropped triage + add-new-app) kept the plan small. → RP-001
- Per-task TDD with fresh implementers surfaced the real Boot 4.1 behaviour the plan text got wrong (the security chain runs inside the management child context) through measured RED evidence, and the fix loop converged in one round. → context-only
- The final whole-branch review — the one fresh context over the whole diff — caught the single Critical the per-task reviews could not see: the PR-blocking CI job never built the identity/shell images. → RA-002

### What would we like to continue doing?

- Controller-side plan corrections before dispatch (CI action versions, `npm ci`, ephemeral JWT key) so transcriber implementers never inherit known gaps. → context-only
- Folding cross-task review findings into the next task's dispatch as explicit MUSTs with exact line references, so ownership never dangles. → context-only
- Running the `gradlew build` gate in-task for every yaml-touching change (stood up retro item, kept). → RP-003

### What would we like to stop doing?

- Stop drafting plan snippets (script param blocks, compose steps, CI job YAML) without reading the actual files first — Task 6's `-WhatIf` premise, its line numbers, and Task 7's missing image-build step were all unverified drafts that cost a final-review Critical. → RP-006
- Stop assuming bash-based superpowers scripts run on this Windows host — check for bash at setup time and pick the manual fallback immediately. → RA-001
- Stop leaving compose/CI verification claims ambiguous about which surface proved them (image-level vs compose-level healthchecks). → RP-003

### Metrics

metrics: not recorded

---

## 2026-11-20 · Ad-hoc · model-router-cost-rebalance

**Headline:** The pre-change review caught three real cost traps before any edit, and small parse-checked config batches kept every increment verifiable.
**migrated:** true

### What went well?

- The pre-change review caught three real cost traps before any edit: `@fast` is hard read-only (shell/web/websearch denied), the default 4× `costCeiling` would abort the ladder at 1+8 before heavy, and kimi-k2.7-code medium costs more per token than deepseek-v4-pro heavy. → context-only
- Small config batches (enforcement+rules, coverage, descriptions/fallback, review batching) each followed by a JSONC parse check kept every increment verifiable; the timestamped backup gave a clean rollback path for an out-of-repo config. → context-only

### What would we like to continue doing?

- Parse-check the override after every batch and re-read the changed block, even for comment-only edits — a stale comment is still wrong documentation. → context-only
- Gate A/B experiments on a nominated real task at plan start; when none exists, record `deferred — no real task`, keep the incumbent, and finish the plan instead of inventing a synthetic task. → context-only

### What would we like to stop doing?

- Stop writing router rules that assume `@fast` can run shell/web commands or fetch URLs; those tasks belong to the orchestrator or `@medium`. → context-only
- Stop leaving `costRatio` values that exceed the configured `costCeiling` ladder (1+8+10=19 required raising the ceiling to 20); check the sum whenever a ratio changes. → context-only

### Metrics

metrics: not recorded

---

## 2026-11-18 · Plan 5 · showcase-deployment · PR #47

**Headline:** Recon-before-design killed two wrong assumptions before any code existed and produced the exact signatures that made 14 TDD tasks dispatchable.
**migrated:** true

### What went well?

- Recon-before-design killed two wrong assumptions before any code existed (no `/auth` prefix needed — identity namespaces don't collide; demo login is a flag-gated controller, not a second `IdentityProvider` adapter), and the same recon produced exact signatures that made 14 TDD tasks dispatchable without ambiguity. → RP-001
- Per-task TDD with scoped reviews caught the failures that mattered exactly once each: the JWKS file-variant bypass (`JwksController`), the forwarded-host loss (`PreserveHostHeader`), the inert-flag tautology in the seeder test — none reached the branch review. → context-only
- The whole-branch review was pointed at demo-facing failure modes ("what breaks first for the public demo") and found five real ones — the runner leaving demo flags off, a shared rate-limit bucket, a dead GitHub button, a vacuous test, a stale required check — all fixed in one wave. → context-only

### What would we like to continue doing?

- Prove deployments against the artifact that will actually run (compose smoke in CI), and keep flag-gated demo surfaces inert by default with tests that can fail (bean-absence assertions, not just count checks). → RP-003
- Controllers finishing mechanical verification (formatter runs, container probes) when implementers hit step caps keeps capped sessions from stalling the plan. → context-only

### What would we like to stop doing?

- Tasks touching only yaml/scripts still skipped the full `gradlew build` gate locally — Spotless slipped through four times and was caught only in final verification. Run the gate in-task. → RP-003
- Markdown is ungated by prettier; a spec heading got mangled (`### Versions### Versions`) and only the reviewer caught it. Consider a heading-sanity check in `tools/`. → context-only
- Long Docker-heavy tasks (compose, CI smoke) exhausted their step caps three times and needed resumes; give such tasks explicit larger budgets or split them. → context-only

### Metrics

metrics: not recorded

### Retro of the retro

- Rulings for this period: see docs/superpowers/rulings.md. → context-only

---

## 2026-11-13 · Ad-hoc · branch-worktree-cleanup

**Headline:** Step-by-step verification after each mutation caught the one Windows long-path failure before branch deletion, and every protected ref survived untouched.
**migrated:** true

### What went well?

- Step-by-step verification after each mutation caught the one Windows long-path failure (`dependency-pr-repairs` worktree) early, before proceeding to branch deletion. The stash-then-force-remove sequence preserved uncommitted state safely. → context-only
- All protected refs were left untouched: `main`, `chore/restore-agent-routing-config`, `dependabot/npm_and_yarn/nx/angular-24.0.4`, and `.worktrees/pr38` remain exactly as expected. → context-only
- Deleted local branches were archived via tags before removal, so every unmerged state remains recoverable from `archive/*`. → context-only

### What would we like to continue doing?

- Verify `git worktree list`, `git branch -vv --all`, `git tag --list`, and `git stash list` as a final four-way check after any destructive repo cleanup. → context-only
- Stash dirty worktrees explicitly by path before force-removing them, and keep the stash message tied to the worktree purpose. → context-only

### What would we like to stop doing?

- Stop relying on `git worktree remove --force` on Windows paths that may exceed `MAX_PATH`; have a fallback ready (e.g., `Remove-Item` with `-LiteralPath`, or robocopy/mirror empty) and prune afterward. → context-only
- Stop using `&&` in PowerShell command strings; use `;` as the statement separator or invoke each command separately. → context-only

### Metrics

metrics: not recorded

### Retro of the retro

- Rulings for this period: see docs/superpowers/rulings.md. → context-only

---

## 2026-11-08 · Ad-hoc · dependabot-pr-repair

**Headline:** The only genuinely failing PR was fixed by systematic debugging, not guesswork, because the published artifact chain exposed the real BOM pin.
**migrated:** true

### What went well?

- The only genuinely failing PR (#24, mockwebserver 4.12.0 -> 5.5.1) was fixed by systematic debugging, not guesswork: CI logs, then local repro, then POM/`.module` inspection, then `dependencyInsight` exposed the real chain — `spring-cloud-dependencies` (via `spring-cloud-commons-dependencies` -> `okhttp-bom`) still pins the okhttp family to 4.12.0, so `mockwebserver3` 5.x ran without OkHttp 5 internals (`NoClassDefFoundError okhttp3/internal/_UtilJvmKt`). The one-line-per-module fix (explicit `okhttp:5.5.1` next to `mockwebserver:5.5.1` in the two BOM-importing modules) was proven locally, then on hosted `tinyurl-backend/build`, before merge. → RA-005
- All 6 PRs landed with the four required checks green on their own head SHAs, and the integrated `main` was re-verified locally with `./gradlew build` (9m04s green). → RP-003

### What would we like to continue doing?

- Read the published artifact chain (POMs, Gradle module metadata, BOM imports) when a class disappears at runtime — repo grep could never have found a pin that lives three BOM imports deep. → context-only
- For branch-protected repos that require up-to-date heads: run a strict serial rebase, then wait for green on the head SHA, then merge, and verify every step's output (nothing piped to `Out-Null`). → RP-003

### What would we like to stop doing?

- Stop writing merge-automation loops that rebase against a cached `origin/main` ref: one 80-minute loop failed silently because each round used a stale base; the fix was fetching `origin/main` after every merge. → context-only
- Stop inferring check status from loosely filtered `gh pr checks` text lines (a `pending` line slipped through); use the JSON `statusCheckRollup` keyed to the head SHA instead. → context-only

### Metrics

metrics: not recorded

### Retro of the retro

- Rulings for this period: see docs/superpowers/rulings.md. → context-only

---

## 2026-10-24 · Plan 4 · tinyurl · PR #20

**Headline:** Deep review and Testcontainers/browser tests caught real defects beyond happy-path coverage, and the PR's first hosted run proved the value of executable CI.
**migrated:** true

### What went well?

- The end-to-end TinyURL slice landed: independent Spring/PostgreSQL service, full microfrontend, runtime remote replacement, deploy artifacts, and CI proof jobs; the PR's backend, frontend, k3s, ARM, prod-login, shell E2E, and standard checks all passed before merge. → RP-003
- Deep review and Testcontainers/browser tests caught real defects beyond happy-path unit coverage: PostgreSQL slug-collision retry needed transaction isolation, committed matrix fixtures polluted later tests, and production short links needed an absolute same-origin URL. → RP-002
- The PR's first hosted run proved the value of executable CI: it exposed missing Postgres manifests and runner assumptions around npm's Node version, Buildx attestation support, ARM base-image availability, Trivy's scan platform, and x86-vs-ARM prod-login execution. Each failure was traced from logs and fixed; the final hosted run passed without deploying or enabling CD. → RA-004

### What would we like to continue doing?

- Keep deep review mandatory for high-shape service/auth/CI changes, and take every Critical/Important finding through a specific RED-GREEN regression test and one fix pass. → RP-002
- Keep real runtime proofs: browser E2E for new user flows, and hosted k3s/ARM jobs for deploy artifacts. Structural workflow assertions are useful, but the PR run is the proof. → RP-003
- Keep environment and architecture explicit (Node 24, Buildx builder, image base platform, Trivy scan platform), and record deviations/rulings in the ledger while they're fresh. → context-only

### What would we like to stop doing?

- Stop assuming hosted-runner defaults match local state: implicit Node/npm and Buildx drivers broke the image job despite local builds passing. → context-only
- Stop validating only that an image builds on the developer's architecture; inspect the official manifest list and test the actual target architecture before declaring the artifact ready. → context-only
- Stop treating Compose `up --wait` as application readiness without a healthcheck, and keep variables needed by teardown/diagnostic steps at a scope those steps can read. → context-only
- Stop closing a plan on structural CI tests alone; wait for the required checks on its PR to complete. → RP-005

### Metrics

metrics: not recorded

---

## 2026-10-20 · Plan 3 · shell-gateway · PR #17

**Headline:** The single Playwright E2E paid for itself immediately by catching the one defect unit tests masked while the plan's back half ran with zero retries.
**migrated:** true

### What went well?

- The back half of the plan ran nearly friction-free: Tasks 10–13, 14, and 17 completed with **zero retries**; the only in-task loops were one webpack-pin ruling (Task 15) and Task 16's integration debugging. → context-only
- The single Playwright E2E (Task 16) paid for itself immediately: it caught the one defect unit tests masked (duplicate `applyMetadata` hidden by Jest's transpile-only run, fixed in d45ad78) and proved the genuinely new runtime behavior — dynamic remote loading — in a real browser. → RA-003
- Deep review (`glm-5.3`, High-shape override) found 2 Critical + 2 Important + 10 Minor issues **before** merge, and all of them were closed in a single fix pass (`2f98f95`) with every gate green — no architectural rework; the contracted design held. → RP-002
- Task 16's three findings (NG0201 wiring gap, ESM-vs-classic remoteEntry, duplicate testids) each went through a clean RED-GREEN cycle under `systematic-debugging` — no guess-patching, no model escalation. → context-only
- Model routing matched the work: flash tier executed all 17 build tasks with single-digit total retries, and the deep-review tier caught what flash could not be asked to self-assess. → context-only

### What would we like to continue doing?

- **Keep the one real-browser E2E for genuinely new runtime behavior.** Jest transpiles without full type/build checking; the browser run was the only gate that saw the Task 14 defect. → RP-003
- **Keep deep review mandatory for High-shape (security-sensitive) plans** — the CSP/auth/MF surface produced 4 Critical/Important findings that justified the pass. → RP-002
- **Keep writing `Ruling:` ledger lines at the moment of deviation** (Boot 4 module paths, webpack `5.109.2`): the ledger made this completion retrospective writable from the record alone, no archaeology needed. → context-only
- **Keep `systematic-debugging` as the mandatory response the moment an integration problem survives one failed hypothesis.** → context-only

### What would we like to stop doing?

- **Stop treating "tests green" as "task done" for UI code.** Run the production build (`npx nx build`) on the touched project before closing the task — Task 14 closed clean, yet its defect survived until the Task 16 browser run because Jest never fully compiles. → RP-004
- **Stop writing multi-block integration config (gateway route yaml, MF config) in one large pass.** Task 7's self-inflicted yaml nesting bug cost a diagnostic loop; smallest-verifiable-increment config writes avoid the whole class. → RA-006
- **Stop writing mid-plan retrospective entries with "pending completion" caveats.** Two overlapping Plan 3 entries now sit in this file (in inverted order); one entry per plan, at completion, keeps the record authoritative — fold interim observations into the dispatch ledger instead. → context-only

### Metrics

metrics: not recorded
