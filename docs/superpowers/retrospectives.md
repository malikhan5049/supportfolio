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

## 2026-11-22 · Plan 8 · one-command-start · PR #52

**Headline:** The manifest-driven orchestrator collapsed a six-terminal boot into one command per project per mode and shipped with the tests that enforce it — verified end to end, not just in CI.

### Previous actions reviewed

- RA-001 — carried — the plan template still names no Windows/bash fallback for the superpowers scripts, so this plan ran manual PowerShell equivalents in its workspace.
- RA-002 — carried — PR #52's CI still does not build the identity and shell images in a PR-blocking job; they remain demo-stack-only.
- RP-001 — kept — preflight recon (conflict scan plus self-review) caught two plan defects before any task ran: an unsatisfiable Ajv assertion and wait-on URLs pointed at public ports instead of management ports.
- RP-002 — kept — all 13 tasks received an implementer plus an independent reviewer, two batched cross-cutting waves closed cross-task findings, and the final whole-branch review's fix waves were re-reviewed clean.
- RP-003 — kept — runtime behaviour was verified end to end (dev loop, standalone prod, teardown) and the PR's 18 required checks were green at merge.
- RP-007 — kept — the orchestrator shipped together with the genericity and spec tests that enforce its manifest contract, so "add a project = manifest plus one script line" is checked by the tool that ships.

### What went well?

- The manifest-driven design turned a six-terminal boot into one command per project per mode while every service still runs standalone: `prod:tinyurl` was verified serving on port 18082 with no shell involved. → context-only
- Per-task SDD reviews with fresh, task-scoped reviewers caught contract drift early — the generated registry entry shape and per-command env delivery were corrected before they compounded across tasks. → RP-002
- Preflight recon (conflict scan plus self-review) killed two plan defects before any task ran: an unsatisfiable Ajv assertion and wait-on URLs pointed at public ports instead of management ports. → context-only

### What would we like to continue doing?

- The implementer plus independent-reviewer loop on every task, with controller-verified test evidence, so no reviewer inherits the author's assumptions. → RP-002
- Verifying runtime behaviour end to end — the 8-process dev loop with Java DevTools reload, registry/JWKS/prometheus proofs, the IPv6 port-preflight gate, prod standalone at 18082, and a full teardown — instead of trusting a green build. → context-only
- Shipping the enforcement with the thing enforced: the orchestrator landed with the genericity and spec tests that check "add a project = manifest plus one script line". → RP-007

### What would we like to stop doing?

- Stop recomposing CLI invocations from memory instead of copying the repo's documented commands: `--testPathPattern` (singular) is not this repo's Jest flag, and `./gradlew build -x e2e` named a Gradle task this repo does not have, failing twice before the real CI gate line was copied verbatim from `AGENTS.md`. → RP-008
- Stop executing plans that predate the retrospective template without checking their record: `docs/superpowers/plans/2026-11-22-one-command-start.md` carries no `## Dispatch Ledger` and no `## Retrospective compliance` section, so its compliance was unverifiable from the record itself; plans are read-only records, so the gap is noted here instead of amended. → context-only

### Metrics

tasks 13 · retries 2 · escaped defects 0 · review ~40-findings-deferred

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
