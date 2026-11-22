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

## 2026-11-22 · Plan 7 · retrospective-system

**Headline:** The retrospective system shipped tools-first and then gated its own first entry — the final review caught the one defect six per-task reviews missed.

### Previous actions reviewed

- RA-001 — carried — `docs/superpowers/plan-template.md` still names no Windows/bash fallback for the superpowers scripts, so the done-when is unmet.
- RA-002 — carried — building the identity and shell images in the PR job is outside this plan's docs/tools scope.
- RP-001 — kept — the design and a builder check ran before any task, and the migration read the records before rewriting them.
- RP-002 — kept — the final whole-branch review ran before merge and closed its Critical through a regression.
- RP-003 — kept — the real `retro-rotate` and `retro-validate` CLI runs in the worktree verified the artifact that ships, not a mock.

### What went well?

- Landing the enforcement tools before the content they gate (Tasks 1–5 ahead of the migration) meant the migration was gated by its own validator, which caught or exposed every content defect. → RP-007
- The human checkpoint on the register — the one place a person, not a tool, owns the record — kept the closed and retired tables honest while the schema was still moving. → context-only
- N1 survived six per-task reviews and died in the final whole-branch review, which is exactly the layer it existed for. → RP-002

### What would we like to continue doing?

- The per-plan review loop with fresh reviewers, each scoped to its task's diff, so no reviewer inherits the author's assumptions. → RP-002
- Recording rulings at deviation time (R1–R25): that is what made the final review's triage — keep, fix, or re-file — decidable in one pass instead of an archaeology exercise. → context-only

### What would we like to stop doing?

- Stop drafting CLI invocations into a plan without running them in the target tree: `--testPathPattern` is not this repo's Jest flag, and the root `ROADMAP.md` filter pointed at a path that never existed here — both written from memory, which is RP-001's rule violated at plan-writing time and recurring after RP-006 was retired for exactly this. → RP-001

### Metrics

tasks 12 · retries 9 · escaped defects 1 · review ~18-findings

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
