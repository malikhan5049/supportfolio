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
- **Keep writing `Ruling:` ledger lines at the moment of deviation** (Boot 4 module paths, webpack `5.109.2`): the ledger made this completion retrospective writable from the record alone, no archaeology needed.
- **Keep `systematic-debugging` as the mandatory response the moment an integration problem survives one failed hypothesis.**

### What should we stop doing?

- **Stop treating "tests green" as "task done" for UI code.** Run the production build (`npx nx build`) on the touched project before closing the task — Task 14 closed clean, yet its defect survived until the Task 16 browser run because Jest never fully compiles.
- **Stop writing multi-block integration config (gateway route yaml, MF config) in one large pass.** Task 7's self-inflicted yaml nesting bug cost a diagnostic loop; smallest-verifiable-increment config writes avoid the whole class.
- **Stop writing mid-plan retrospective entries with "pending completion" caveats.** Two overlapping Plan 3 entries now sit in this file (in inverted order); one entry per plan, at completion, keeps the record authoritative — fold interim observations into the dispatch ledger instead.

---

## 2026-10-20 · Task 1–9 of Plan 3 (shell/gateway) — code tasks pending completion

### What went well?

- Plan granularity matched execution: one test-first cycle per task, few surprises in the flow.
- The contracted architecture paid off immediately: no CORS needed anywhere, the starter's resource-server chain was reused by the shell **unmodified**, and the one-time-code redirect/store flow worked on the first end-to-end run.
- All mistakes (permit-path yaml errors, security rings, TestSecurity misconfig) were caught by the test run before any commit — the RED→GREEN gate did its job every time.
- Package-by-feature and the two build-configuration rulings from the plans are now encoded in the codebase (Boot 4 module paths; no-redirect-trick for SPA polling).

### Keep doing (keep doing)

- One RED→GREEN test cycle per task before any implementation exists.
- Boot 4 module naming awareness from the start: `spring-boot-webmvc-test` / `@AutoConfigureMockMvc` path (`org.springframework.boot.webmvc.test.autoconfigure`) — do not use the Boot 3 test paths.
- Record every deviation from the plan in the dispatch ledger as a `Ruling:` line at the moment it happens; the ledger is the memory between sessions.
- Keep the npm test config names, `mockwebserver 4.12.0`, and `@webmvc.test` module paths consistent — divergence costs a rebuild cycle.
- Keep PII out of logs, secrets out of the repo (gauntlets proved effective so far).

### Stop doing (stop doing)

- **Do not trust plan-code verbatim.** Test snippets and build-configuration blocks in the plan are *references*, not ground truth; verify module paths and dependency coordinates against the actual repo state and package registry before writing the first test. Task 3 lost time to Boot 3 module paths and Maven `@mvn` module assumptions that don't exist here.
- **Do not write "wired by Task N intermediates" placeholders in test files** while hunting for compile anchors; write the intended test directly (as in this session's incidents on Tasks 5/6/9/14), which were noise in otherwise clean runs.
- **Do not break plan-task ownership boundaries**: `Pending` test code in the shell belonged to Task 3, not the still-open Task 14 build — explicit `Ensure: task-scoped validation` before running task tests, so tasks can be assumed done when they say done.
- **Do not re-implement environment internals when the shell can delegate**: the shared `RemoteRegistryService` reimbursing `environment.registryUrl` defaults was re-typed in `LoginRedirectController`, `auth-registry` branches and `SessionControllerTest` — prefer the shared registry/`env` file once.
- **Do not commit generated `dist/` output** — those artifacts got tracked unintentionally; keep `.gitignore` guarding them.

---

## 2026-10-20 · Task 1–14 of Plan 3 (shell/gateway)

### What went well?

- Animated, task-by-task progress (with per-task RED steps) kept the loop honest and audit facing.
- The plan's risk sections (Review Focus) were directly translatable: every checklist item ended in a real test.

### What should we keep doing (carry into Plan 4 and later)?

- **Keep** the same 12-task cadence for the remaining Project 4 work.
- **Keep** every test one step behind coding: run the failing test, then implement, then watch it pass — and explicitly print both results.
- **Keep** booting a real MVC context for all integration tests (`@SpringBootTest + MockMvc`), not similar-but-looser write-ba (the `RejectsAnonymousRequests` test caught the missing config only because it ran through the real chain).

### What should we stop doing (before the next task starts)?

- **Stop** the "task 3 judged OK in 1 test instead of expected chain" pattern: the first pass of `returnsClaimsFromTheValidatedJwt` used the lax assertion (`@AutoConfigureMockMvc` with a system processor) rather than the full test that the plan called for; the correct chain-issued version came **after** the fix. Build assertions first, exactly as written.
- **Stop** tolerating quiet import drift: `RejectsAnonymousRequests`-style imports crept in (between module paths) and only surfaced at build time. Prefer importing from the module gate: `spring-security-oauth2`, `spring-boot-webmvc-test`.
- **Stop** proceeding with a green test run reported on *cached* task output when the config files change — rerun.

---

_Formatted representation: each section like this one, newest first. Insert between the header and the first existing entry._
