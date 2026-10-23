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
  - **Ruling 2026-10-23:** Deep-tier agents (`brainstorm-deep`, `plan-deep`, `reviewer-deep`) moved from glm-5.3 to deepseek-v4-pro at user direction - half input cost, ~12x cheaper cache read. Deep review stays mandatory for High-shape plans; revisit if deep-review finding quality regresses.
- **Keep writing `Ruling:` ledger lines at the moment of deviation** (Boot 4 module paths, webpack `5.109.2`): the ledger made this completion retrospective writable from the record alone, no archaeology needed.
- **Keep `systematic-debugging` as the mandatory response the moment an integration problem survives one failed hypothesis.**

### What should we stop doing?

- **Stop treating "tests green" as "task done" for UI code.** Run the production build (`npx nx build`) on the touched project before closing the task — Task 14 closed clean, yet its defect survived until the Task 16 browser run because Jest never fully compiles.
- **Stop writing multi-block integration config (gateway route yaml, MF config) in one large pass.** Task 7's self-inflicted yaml nesting bug cost a diagnostic loop; smallest-verifiable-increment config writes avoid the whole class.
- **Stop writing mid-plan retrospective entries with "pending completion" caveats.** Two overlapping Plan 3 entries now sit in this file (in inverted order); one entry per plan, at completion, keeps the record authoritative — fold interim observations into the dispatch ledger instead.

---



