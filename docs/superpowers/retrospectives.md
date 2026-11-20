# Retrospectives

**How to use this file:**

- After every plan completes, append an entry at the TOP (descending order, newest first) answering
  three questions: **What went well?** / **What should we keep doing?** / **What should we stop doing?**
- Every entry is timestamped and tagged with the plan it covers.
- **Before writing any new plan, read this file from the top and apply every standing item to the
  plan: contradicted practices must not be repeated; pending improvements should be folded into the
  task list or explicitly deferred with a reason.** If a task contradicts a standing item, wait —
  the plan must either comply or record a justification next to the ledger entry.

---

## 2026-11-20 · Plan complete — Plan 6 telemetry (Tasks 1–8, whole-branch review, fix wave)

### What went well?

- Recon-before-design plus a builder check caught the plan's one real contradiction (a management port also moves health, breaking every `--wait` probe) before any task existed, and the narrowed scope (human dropped triage + add-new-app) kept the plan small.
- Per-task TDD with fresh implementers surfaced the real Boot 4.1 behaviour the plan text got wrong (the security chain runs inside the management child context) through measured RED evidence, and the fix loop converged in one round.
- The final whole-branch review — the one fresh context over the whole diff — caught the single Critical the per-task reviews could not see: the PR-blocking CI job never built the identity/shell images.

### What would we like to continue doing?

- Controller-side plan corrections before dispatch (CI action versions, `npm ci`, ephemeral JWT key) so transcriber implementers never inherit known gaps.
- Folding cross-task review findings into the next task's dispatch as explicit MUSTs with exact line references, so ownership never dangles.
- Running the `gradlew build` gate in-task for every yaml-touching change (stood up retro item, kept).

### What would we like to stop doing?

- Stop drafting plan snippets (script param blocks, compose steps, CI job YAML) without reading the actual files first — Task 6's `-WhatIf` premise, its line numbers, and Task 7's missing image-build step were all unverified drafts that cost a final-review Critical.
- Stop assuming bash-based superpowers scripts run on this Windows host — check for bash at setup time and pick the manual fallback immediately.
- Stop leaving compose/CI verification claims ambiguous about which surface proved them (image-level vs compose-level healthchecks).

---


### What went well?

- Recon-before-design killed two wrong assumptions before any code existed (no `/auth` prefix needed — identity namespaces don't collide; demo login is a flag-gated controller, not a second `IdentityProvider` adapter), and the same recon produced exact signatures that made 14 TDD tasks dispatchable without ambiguity.
- Per-task TDD with scoped reviews caught the failures that mattered exactly once each: the JWKS file-variant bypass (`JwksController`), the forwarded-host loss (`PreserveHostHeader`), the inert-flag tautology in the seeder test — none reached the branch review.
- The whole-branch review was pointed at demo-facing failure modes ("what breaks first for the public demo") and found five real ones — the runner leaving demo flags off, a shared rate-limit bucket, a dead GitHub button, a vacuous test, a stale required check — all fixed in one wave.

### What would we like to continue doing?

- Prove deployments against the artifact that will actually run (compose smoke in CI), and keep flag-gated demo surfaces inert by default with tests that can fail (bean-absence assertions, not just count checks).
- Controllers finishing mechanical verification (formatter runs, container probes) when implementers hit step caps keeps capped sessions from stalling the plan.

### What would we like to stop doing?

- Tasks touching only yaml/scripts still skipped the full `gradlew build` gate locally — Spotless slipped through four times and was caught only in final verification. Run the gate in-task.
- Markdown is ungated by prettier; a spec heading got mangled (`### Versions### Versions`) and only the reviewer caught it. Consider a heading-sanity check in `tools/`.
- Long Docker-heavy tasks (compose, CI smoke) exhausted their step caps three times and needed resumes; give such tasks explicit larger budgets or split them.

---

## 2026-11-20 · Model router cost rebalance

### What went well?

- The pre-change review caught three real cost traps before any edit: `@fast` is hard read-only (shell/web/websearch denied), the default 4× `costCeiling` would abort the ladder at 1+8 before heavy, and kimi-k2.7-code medium costs more per token than deepseek-v4-pro heavy.
- Small config batches (enforcement+rules, coverage, descriptions/fallback, review batching) each followed by a JSONC parse check kept every increment verifiable; the timestamped backup gave a clean rollback path for an out-of-repo config.

### What would we like to continue doing?

- Parse-check the override after every batch and re-read the changed block, even for comment-only edits — a stale comment is still wrong documentation.
- Gate A/B experiments on a nominated real task at plan start; when none exists, record `deferred — no real task`, keep the incumbent, and finish the plan instead of inventing a synthetic task.

### What would we like to stop doing?

- Stop writing router rules that assume `@fast` can run shell/web commands or fetch URLs; those tasks belong to the orchestrator or `@medium`.
- Stop leaving `costRatio` values that exceed the configured `costCeiling` ladder (1+8+10=19 required raising the ceiling to 20); check the sum whenever a ratio changes.

## 2026-11-18 · Ruling (task: showcase deployment)

- `Ruling:` Amended two specs marked "read-only records" in place (Oracle/k3s → Cloudflare Quick Tunnel) at the human's explicit request; changes are dated and link the new design.
- `Ruling:` Edited `platform/shell/config/remote-registry.json` (listed under "Do not touch") to root-relative URLs, required for hostname independence; the file remains hot-read and uncached.

---

## 2026-11-13 · Task complete — branch/worktree cleanup and archival

### What went well?

- Step-by-step verification after each mutation caught the one Windows long-path failure (`dependency-pr-repairs` worktree) early, before proceeding to branch deletion. The stash-then-force-remove sequence preserved uncommitted state safely.
- All protected refs were left untouched: `main`, `chore/restore-agent-routing-config`, `dependabot/npm_and_yarn/nx/angular-24.0.4`, and `.worktrees/pr38` remain exactly as expected.
- Deleted local branches were archived via tags before removal, so every unmerged state remains recoverable from `archive/*`.

### What would we like to continue doing?

- Verify `git worktree list`, `git branch -vv --all`, `git tag --list`, and `git stash list` as a final four-way check after any destructive repo cleanup.
- Stash dirty worktrees explicitly by path before force-removing them, and keep the stash message tied to the worktree purpose.

### What would we like to stop doing?

- Stop relying on `git worktree remove --force` on Windows paths that may exceed `MAX_PATH`; have a fallback ready (e.g., `Remove-Item` with `-LiteralPath`, or robocopy/mirror empty) and prune afterward.
- Stop using `&&` in PowerShell command strings; use `;` as the statement separator or invoke each command separately.

## 2026-11-13 · Ruling (task: push rejected main commits)

- `Ruling:` Orchestrator handled the git branch/push/PR mutations directly instead of dispatching subagents — state-changing git operations against repo-rule-protected `main` are too risky to delegate blind; info-gathering stayed within the 2-call direct allowance. Result: branch `chore/dependabot-security-only` pushed, PR #43 opened, local `main` reset to `origin/main`.

## 2026-11-08 · Task complete — repair and merge the 6 open Dependabot PRs (#24, #25, #26, #27, #32, #33)

### What went well?

- The only genuinely failing PR (#24, mockwebserver 4.12.0 → 5.5.1) was fixed by systematic debugging, not guesswork: CI logs → local repro → POM/`.module` inspection → `dependencyInsight` exposed the real chain — `spring-cloud-dependencies` (via `spring-cloud-commons-dependencies` → `okhttp-bom`) still pins the okhttp family to 4.12.0, so `mockwebserver3` 5.x ran without OkHttp 5 internals (`NoClassDefFoundError okhttp3/internal/_UtilJvmKt`). The one-line-per-module fix (explicit `okhttp:5.5.1` next to `mockwebserver:5.5.1` in the two BOM-importing modules) was proven locally, then on hosted `tinyurl-backend/build`, before merge.
- All 6 PRs landed with the four required checks green on their own head SHAs, and the integrated `main` was re-verified locally with `./gradlew build` (9m04s green).

### What would we like to continue doing?

- Read the published artifact chain (POMs, Gradle module metadata, BOM imports) when a class disappears at runtime — repo grep could never have found a pin that lives three BOM imports deep.
- For branch-protected repos that require up-to-date heads: run a strict serial rebase → wait-for-green-on-head-SHA → merge cycle, and verify every step's output (nothing piped to `Out-Null`).

### What would we like to stop doing?

- Stop writing merge-automation loops that rebase against a cached `origin/main` ref: one 80-minute loop failed silently because each round used a stale base; the fix was fetching `origin/main` after every merge.
- Stop inferring check status from loosely filtered `gh pr checks` text lines (a `pending` line slipped through); use the JSON `statusCheckRollup` keyed to the head SHA instead.

`Ruling:` the 2026-11-08 AGENTS.md update routes mechanical work to dispatched subagents; this harness exposes no subagent tool, so steps ran inline on the controller.

---

## 2026-10-24 · Plan 4 complete — TinyURL (Tasks 0–27, deep review, merged via #20)

### What went well?

- The end-to-end TinyURL slice landed: independent Spring/PostgreSQL service, full microfrontend, runtime remote replacement, deploy artifacts, and CI proof jobs; the PR's backend, frontend, k3s, ARM, prod-login, shell E2E, and standard checks all passed before merge.
- Deep review and Testcontainers/browser tests caught real defects beyond happy-path unit coverage: PostgreSQL slug-collision retry needed transaction isolation, committed matrix fixtures polluted later tests, and production short links needed an absolute same-origin URL.
- The PR's first hosted run proved the value of executable CI: it exposed missing Postgres manifests and runner assumptions around npm's Node version, Buildx attestation support, ARM base-image availability, Trivy's scan platform, and x86-vs-ARM prod-login execution. Each failure was traced from logs and fixed; the final hosted run passed without deploying or enabling CD.

### What should we keep doing?

- Keep deep review mandatory for high-shape service/auth/CI changes, and take every Critical/Important finding through a specific RED→GREEN regression test and one fix pass.
- Keep real runtime proofs: browser E2E for new user flows, and hosted k3s/ARM jobs for deploy artifacts. Structural workflow assertions are useful, but the PR run is the proof.
- Keep environment and architecture explicit (Node 24, Buildx builder, image base platform, Trivy scan platform), and record deviations/rulings in the ledger while they're fresh.

### What should we stop doing?

- Stop assuming hosted-runner defaults match local state: implicit Node/npm and Buildx drivers broke the image job despite local builds passing.
- Stop validating only that an image builds on the developer's architecture; inspect the official manifest list and test the actual target architecture before declaring the artifact ready.
- Stop treating Compose `up --wait` as application readiness without a healthcheck, and keep variables needed by teardown/diagnostic steps at a scope those steps can read.
- Stop closing a plan on structural CI tests alone; wait for the required checks on its PR to complete.

---

## 2026-10-20 · Plan 3 complete — shell/gateway (Tasks 1–17, deep review, merged via #17)

### What went well?

- The back half of the plan ran nearly friction-free: Tasks 10–13, 14, and 17 completed with **zero retries**; the only in-task loops were one webpack-pin ruling (Task 15) and Task 16's integration debugging.
- The single Playwright E2E (Task 16) paid for itself immediately: it caught the one defect unit tests masked (duplicate `applyMetadata` hidden by Jest's transpile-only run, fixed in d45ad78) and proved the genuinely new runtime behavior — dynamic remote loading — in a real browser.
- Deep review (`glm-5.3`, High-shape override) found 2 Critical + 2 Important + 10 Minor issues **before** merge, and all of them were closed in a single fix pass (`2f98f95`) with every gate green — no architectural rework; the contracted design held.
- Task 16's three findings (NG0201 wiring gap, ESM-vs-classic remoteEntry, duplicate testids) each went through a clean RED→GREEN cycle under `systematic-debugging` — no guess-patching, no model escalation.
- Model routing matched the work: flash tier executed all 17 build tasks with single-digit total retries, and the deep-review tier caught what flash could not be asked to self-assess.

### What should we keep doing?

- **Keep the one real-browser E2E for genuinely new runtime behavior.** Jest transpiles without full type/build checking; the browser run was the only gate that saw the Task 14 defect.
- **Keep deep review mandatory for High-shape (security-sensitive) plans** — the CSP/auth/MF surface produced 4 Critical/Important findings that justified the pass.
- **Keep writing `Ruling:` ledger lines at the moment of deviation** (Boot 4 module paths, webpack `5.109.2`): the ledger made this completion retrospective writable from the record alone, no archaeology needed.
- **Keep `systematic-debugging` as the mandatory response the moment an integration problem survives one failed hypothesis.**

### What should we stop doing?

- **Stop treating "tests green" as "task done" for UI code.** Run the production build (`npx nx build`) on the touched project before closing the task — Task 14 closed clean, yet its defect survived until the Task 16 browser run because Jest never fully compiles.
- **Stop writing multi-block integration config (gateway route yaml, MF config) in one large pass.** Task 7's self-inflicted yaml nesting bug cost a diagnostic loop; smallest-verifiable-increment config writes avoid the whole class.
- **Stop writing mid-plan retrospective entries with "pending completion" caveats.** Two overlapping Plan 3 entries now sit in this file (in inverted order); one entry per plan, at completion, keeps the record authoritative — fold interim observations into the dispatch ledger instead.

---



