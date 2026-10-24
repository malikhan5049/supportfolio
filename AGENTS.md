# Model Routing — Superpowers Phases (binding)

Loaded into every session — keep this file compact. Goal: minimize total cost per
successfully completed task; use the cheapest model that can reliably do the task,
stronger models only when they materially cut errors/retries/rework.

All models are on `opencode-go` unless prefixed `opencode/`.

## Mandatory restrictions (human decisions 2026-10-19)

- Never substitute paid `opencode/*` SKUs for quota-backed/free models.
  `opencode/glm-5.3-flash` bills account funds (fails "insufficient account funds"
  when empty). Flash GLM always means `opencode-go/glm-5.3-flash` (rolling quota).
- `opencode/claude-sonnet-5-5` only with a qualifying trigger (subtle logic,
  multi-file inconsistency, justified higher-reasoning need), reason presented
  first, AND explicit human approval.
- No Kimi/Qwen in Phases 1–3. Phase 7 never on `glm-5.3` or Sonnet. No
  auto-upgrades outside these rules except the escalation path below.
- Never invent model IDs or switch providers/models silently. If no permitted
  model is available, STOP and report.
- Cost ceiling: `glm-5.3` (full) is the most expensive model allowed.

Preferences (non-mandatory): Flash-tier for bulk/multi-step work; deterministic
tools before model calls; full GLM only for high-leverage moments.

## Phase routing (authoritative)

| Phase | Primary | Secondary / fallback |
|---|---|---|
| 1 Brainstorm | `glm-5.3` via `/brainstorm` | sec: low-risk change → `glm-5.3-flash`; fb: `glm-5.3-flash` |
| 2 Spec | `glm-5.3` (same session) | fb: `glm-5.3-flash` |
| 3 Plan | `deepseek-v4.1-flash#high` via `/plan` | sec: `glm-5.3` for one architectural decision only; fb: `glm-5.3-flash` |
| 4 TDD | `glm-5.3-flash` | sec: `qwen3.8-flash` for bulk test scaffolding; fb: `glm-5.3-flash-free` |
| 5 Build | `glm-5.3-flash` | sec: `qwen3.8-flash` for CRUD/boilerplate/bulk; fb: `glm-5.3-flash-free` |
| 6 Review | routine: `deepseek-v4.1-flash` · deep: `glm-5.3` | fb: deep unavailable → `glm-5.3-flash` + flag residual risk |
| 7 Finalize | `deepseek-v4.1-flash` via `/finalize` | fb: `opencode/deepseek-v4.1-flash-free` → `opencode/glm-5.3-flash-free` |

## Fallback doctrine (classify the failure first)

- Model unavailable → table fb column.
- opencode-go quota exhausted (all its models share one pool) → $0 twins
  `opencode/glm-5.3-flash-free` / `opencode/deepseek-v4.1-flash-free`; never paid
  `opencode/*`. Applies to every opencode-go dispatch path.
- Auth/funds errors → provider restriction: take $0 fallback or stop; not a
  reasoning problem.
- Task reasoning failure → escalation, not a fallback swap.

## Task shape (Phases 4–6)

- Low (DTOs, simple CRUD, boilerplate, bulk scaffolding, routine docs) →
  `qwen3.8-flash`; deterministic tools first.
- Medium (business logic, multi-file features, test strategy, nontrivial
  debugging) → `glm-5.3-flash`; carve out bulk subtasks; validate via
  tests/build/lint/static analysis.
- High (ambiguous requirements, architecture choices, cross-service changes,
  concurrency, transactions, authn/authz, security-sensitive edits) → drafting on
  Flash is fine, but decide/review on `glm-5.3` where it prevents rework. Escalate
  only the affected task/decision, then return to the normal tier.

## Review (risk-based)

Routine: `deepseek-v4.1-flash` reviewer (edit-denied) — regressions, edge cases,
test coverage + results, architecture/convention consistency, obvious
security/data-integrity concerns.

Deep: `glm-5.3` — required for High-shape changes or when routine review finds a
material unresolved issue. Reviewer success is not evidence: tests, build, and
static analysis decide. A model's disagreement with another model alone never
escalates.

## Escalation

Before any retry: capture failing test/build output + diff → classify cause
(logic / context / bad assumption / environment / deps / quota) → form a materially
different hypothesis. No superficial patch loops.

- Escalate the single affected task to `glm-5.3` after 3 ineffective attempts on
  the same failure, or sooner on architectural misunderstanding or reasoning
  limits. Record in ledger; one full-model pass, then back to the normal tier.
- Never escalate for environment failures, missing deps, bad config, or
  quota/auth errors — fix the environment or take the fallback.

## Dispatch ledger

Controller appends `## Dispatch Ledger` to the active plan
(`docs/superpowers/plans/<plan>.md`), one row per task — not per tool call:
`| Task | Phase | Shape | Model | Why | Outcome (tests/build) | Retries/escalation |`.
`/finalize` reports routing outcomes (first-pass success, retries/escalations,
review findings by severity) in the PR summary. Providers expose no token/cost
data — record that limitation; proxy = dispatch counts per tier. Never fabricate
costs, usage, or benchmarks.

## Config enforcement

Repo `opencode.json` pins (overrides global, this repo only): session +
`general` → `opencode-go/glm-5.3-flash`; `explore` → `opencode/mimo-v2.6-flash-free`;
`reviewer` → `opencode-go/deepseek-v4.1-flash` (edit-denied). Deep review is an
explicit `glm-5.3` model override at dispatch. `/plan`, `/finalize`, `/brainstorm`
pin their phase models in frontmatter. Everything not pinned is advisory.

## Plan retrospective (binding)

At the end of every completed plan, before reporting the plan complete:

- Add one timestamped, plan-tagged entry at the top of
  `docs/superpowers/retrospectives.md` answering: **What went well?**,
  **What would we like to continue doing?**, and **What would we like to
  stop doing?**
- Present the same three answers to the human in the completion message.
- Write the entry once, after the plan is complete; do not add mid-plan retrospective entries.
