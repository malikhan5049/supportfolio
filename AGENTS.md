# Model Routing — Superpowers Phases (binding)

Applies to every agent working in this repo: the session/controller, all subagents,
and all slash commands. Global rules:

- **GLM-5.3 (full) is the highest-cost model allowed for general use.**
- Never use Kimi or Qwen for planning, brainstorming, or spec phases.
- Never use Claude Sonnet except in Phase 6 when absolutely necessary (human-approved).
- Prefer Flash-tier models for bulk work and multi-step execution.
- Strict phase-model isolation: never auto-upgrade a model outside these rules.

## Phase routing

| Phase | Primary | Upgrade / secondary | Fallback |
|---|---|---|---|
| 1. Brainstorming | `opencode/glm-5.3` via `/brainstorm` | — | `opencode/glm-5.3-flash` |
| 2. Spec | `opencode/glm-5.3` (same session as `/brainstorm`) | — | `opencode/glm-5.3-flash` |
| 3. Plan | `opencode-go/deepseek-v4.1-flash#high` via `/plan` | — | `opencode/glm-5.3-flash` |
| 4. TDD — test strategy, complex test logic | `opencode/glm-5.3-flash` (implementer dispatch) | `opencode-go/qwen3.8-flash` for bulk/repetitive test generation | `opencode/glm-5.3-flash` |
| 5. Build — main code execution | `opencode/glm-5.3-flash` (implementer dispatch) | `opencode/glm-5.3-flash` for multi-file consistency; `opencode-go/qwen3.8-flash` for simple CRUD/boilerplate expansions | — |
| 6. Review — adversarial | `opencode/glm-5.3` (full) | `opencode/claude-sonnet-5-5` ONLY if subtle logic issues are detected, multi-file inconsistencies appear, or the system requests higher reasoning — with explicit human approval | `opencode-go/deepseek-v4.1-flash` |
| 7. Finalize — summarization, docs, PR prep | `opencode-go/deepseek-v4.1-flash` via `/finalize` | — | `opencode/glm-5.3-flash` |

Goals per phase (why the routing is shaped this way): maximize reasoning quality and
reduce cycles (1), stable complete specs with minimal revisions (2), structured plans
efficiently (3), test-first with minimal mistakes (4), coding throughput with
consistency (5), adversarial review with minimal cycles and maximum correctness (6),
cheap clean finalization (7).

## Dispatch rules (SDD execution, Phases 4–6)

- Session/controller default: `opencode/glm-5.3-flash`.
- Every implementer dispatch carries an explicit model chosen per task shape:
  - complex logic / test-strategy-heavy → `opencode/glm-5.3-flash`
  - multi-file consistency-sensitive → `opencode/glm-5.3-flash`
  - bulk, repetitive, boilerplate, simple CRUD → `opencode-go/qwen3.8-flash`
- Reviewer dispatches (the `reviewer` agent, edit-denied) run on `opencode/glm-5.3`
  by default. Upgrading a review to `opencode/claude-sonnet-5-5` requires the
  controller to present the trigger (subtle logic / multi-file inconsistency /
  reasoning request) AND the human's explicit approval first.
- Record the model used for every dispatch in the plan's ledger.
- Finalization (Phase 7) runs via `/finalize` or a deepseek-v4.1-flash dispatch —
  never on glm-5.3 or sonnet.

## Model-name substitutions (catalog reality)

These configured names do not exist verbatim in the available catalogs; the agreed
substitutes are:

- "Qwen 2.5 Coder" → `opencode-go/qwen3.8-flash` (closest flash-class Qwen coder;
  confirmed by human 2026-10-19)
- "MiMo V2.6 Flash" → `opencode/glm-5.3-flash` (MiMo Flash retired; routed here
  by human request 2026-10-19)
- "DeepSeek V3 Lite" → `opencode-go/deepseek-v4.1-flash` (the only Lite/Flash-class
  DeepSeek)
