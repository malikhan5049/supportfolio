# Model Routing — Superpowers Phases (binding)

Applies to every agent working in this repo: the session/controller, all subagents,
and all slash commands. Cost ceiling: **GLM-5.3 (full) is the most expensive model
allowed.** Claude Sonnet 5.5 is reserved for Phase 6 (code review) and requires
explicit human approval per use.

## Phase routing

| Phase | Primary | Fallback / secondary | Restrictions |
|---|---|---|---|
| 1. Brainstorming | `opencode/glm-5.3` via `/brainstorm` | `opencode/glm-5.3-flash` | Never Kimi, Qwen, or DeepSeek |
| 2. Spec | `opencode/glm-5.3` (same session as `/brainstorm`) | `opencode/glm-5.3-flash` | Sonnet only if the spec is extremely complex AND the human explicitly asks |
| 3. Plan | `opencode-go/deepseek-v4.1-flash#high` via `/plan` | `opencode/glm-5.3-flash` | Never Kimi or Qwen |
| 4. TDD — test strategy, complex test logic | `opencode/glm-5.3-flash` (implementer dispatch) | `opencode/mimo-v2.6-flash-free` | Bulk/repetitive test generation → `opencode-go/qwen3.8-flash` |
| 5. Build — main code execution | `opencode/glm-5.3-flash` (implementer dispatch) | `opencode/mimo-v2.6-flash-free` for multi-file consistency | Simple CRUD/boilerplate → `opencode-go/qwen3.8-flash` |
| 6. Code review | `opencode/claude-sonnet-5-5` — only when the human explicitly approves | `opencode/glm-5.3-flash` for routine task reviews | Ask before every review dispatch: diff stats + model recommendation first |

## Dispatch rules (SDD execution, Phases 4–5)

- Session/controller default: `opencode/glm-5.3-flash`.
- Every implementer dispatch carries an explicit model chosen per task shape:
  - complex logic / test-strategy-heavy → `opencode/glm-5.3-flash`
  - multi-file consistency-sensitive → `opencode/mimo-v2.6-flash-free`
  - bulk, repetitive, boilerplate, simple CRUD → `opencode-go/qwen3.8-flash`
- Record the model used for every dispatch in the plan's ledger.
- Reviewer dispatches wait for explicit human approval (diff stats + recommended
  model first); routine task reviews default to `opencode/glm-5.3-flash`.

## Model-name substitutions (catalog reality)

The configured names below do not exist verbatim in the available catalogs; these
are the agreed substitutes:

- "Qwen 2.5 Coder" → `opencode-go/qwen3.8-flash` (closest flash-class Qwen coder)
- "MiMo V2.6 Flash" → `opencode/mimo-v2.6-flash-free` (the only MiMo Flash; paid MiMo
  models are pro-tier only)
