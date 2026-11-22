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
