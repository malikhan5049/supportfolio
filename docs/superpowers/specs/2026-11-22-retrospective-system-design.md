# Retrospective system redesign — design

**Date:** 2026-11-22
**Status:** draft (awaiting human approval)
**Scope:** `docs/superpowers/`, `tools/`, `.github/workflows/`, `AGENTS.md`, `ROADMAP.md`

## 1. Intent

The retrospective record exists to make future plans better. Today it is a growing
markdown log that an agent is told to read top-to-bottom before planning. That fails in
three ways: it costs more tokens every month, most of it is irrelevant to any given plan,
and nothing forces the lessons to be applied. This design turns it into a closed loop
with a bounded read surface and a machine check at the planning gate.

## 2. Problem evidence (recon, 2026-11-22)

- `retrospectives.md` is 173 lines: 9 retro bodies, 8 dated headings, and 1 body with no
  heading at all (the Plan 5 showcase retro, lines 38–53).
- The header contract says "What should we keep doing?"; five bodies say "What would we
  like to continue doing?"; two say "What should we keep doing?".
- No IDs, owners, statuses, or closure evidence. "Run `gradlew build` in-task" appears in
  at least three entries; closure is only narrated, never recorded.
- `Ruling:` deviation lines share the file: two Ruling-only entries and one bare paragraph.
- No template, validator, or CI check. Root `package.json` has no `test` script; no
  workflow runs Jest; Prettier's gate excludes `docs/`.
- Cost: roughly 2.6k tokens today, growing ~400 tokens per plan, read at every planning
  session.

## 3. Goals

1. One canonical read surface for planning: a generated brief of at most 50 lines.
2. Durable lessons carry stable IDs (`RP-` practice, `RA-` action) with owner, status,
   and evidence.
3. The hot record is bounded to the last 3 entries; older entries are archived and indexed.
4. Every retro bullet has a disposition, enforced at rotation, so no rule is lost when the
   prose leaves the hot set.
5. Every plan declares how it complies with every RA/RP open on its date; CI rejects plans
   that do not.
6. Every ROADMAP row marked `done` has a retro entry or an explicit exemption.
7. Existing content is migrated without inventing evidence.

## 4. Non-goals

- Changing the superpowers package or its skills (external `node_modules`).
- Sprint or time-based cadence; cadence stays per plan.
- GitHub Issues or Jira integration.
- Auto-generating retrospective prose.
- Editing historical plan and spec records (they remain read-only).

## 5. Anti-goals

- A template nobody checks.
- Unbounded growth of any committed file.
- Two sources of truth for action state.
- Blocking legitimate deviations — `Ruling:` survives, in its own file.

## 6. Constraints

- Windows/PowerShell first; Node 24; `tsx` is the established runner for `tools/` scripts
  (`validate-manifests.yml` uses `npx tsx tools/validate-all-manifests.ts`).
- `tools/` is plain Node/Jest TS, not on the Nx graph; `tools/*.spec.ts` are not executed
  by any CI workflow today.
- Prettier does not check `docs/**/*.md`, so document structure must be validated by our
  own tool.
- `AGENTS.md` protects CI workflows; this task is explicitly governance/CI-scoped and the
  human approved touching CI for it.
- GitHub rules: feature branch plus PR, conventional commits.
- The parser must tolerate CRLF and the `·` separator (U+00B7).

## 7. Approaches considered

| Approach | Shape | Why not chosen |
|---|---|---|
| A. Hardened single file | records and register in one file | a mutable register inside an append-only file; "what's open" gets buried; grows without bound |
| **B. Record + register split** | hot record, register, archive, brief, validator | **chosen** — one job per file, human-editable, and the planning gate is mechanically checkable |
| C. Structured data + generated views | YAML source of truth, generated markdown | generated docs in git, hand-editing YAML, more moving parts than a solo repo needs |

Approach B is the authentic agile split — retrospective notes are not the action backlog —
and it keeps every artifact readable and editable as markdown.

## 8. Design

### 8.1 File layout

```text
docs/superpowers/
  retrospectives.md              HOT record — last 3 entries + contract header
  retro-actions.md               register — open RAs + active RPs (bounded)
  retro/archive/2026.md          COLD — rotated entries, append-only
  retro/archive/INDEX.md         COLD — one line per retro
  rulings.md                     deviation ledger (moved out of retros)
  plan-template.md               plan skeleton including the compliance table
tools/
  retro-lib.ts                   shared parse/format helpers (builder call)
  retro-brief.ts                 prints the planning brief; `--topic` search
  retro-rotate.ts                archives the oldest entry + INDEX row (gated)
  retro-validate.ts              all structural checks; exit 1 on failure
.github/workflows/
  validate-retrospectives.yml    path-filtered CI gate
```

### 8.2 Entry format (identical in hot and archive)

```markdown
## 2026-11-22 · Plan 7 · retrospective-system · PR #52

**Headline:** <one sentence — the single lesson worth remembering>

### Previous actions reviewed

- RA-012 — closed — evidence: PR #52
- RP-003 — kept
- RP-005 — amended — <what changed>

### What went well?

- <observation> → context-only
- <observation> → RP-004

### What would we like to continue doing?

- <practice> → RP-004

### What would we like to stop doing?

- <problem and its fix> → RA-013

### Metrics

tasks 8 · retries 3 · escaped defects 0 · review 2C/4I/9m
```

Rules:

- Heading grammar: `## YYYY-MM-DD · Plan <N|Ad-hoc> · <slug> · PR #<n>`; the PR segment is
  optional for `Ad-hoc` entries.
- `Headline:` is required and is exactly one line.
- `Previous actions reviewed` is required and lists every RA/RP that was open or active at
  entry time, each with one of `closed | kept | amended | retired | carried`.
- The three question sections are required with fixed wording: "What went well?", "What
  would we like to continue doing?", "What would we like to stop doing?".
- Every bullet ends with exactly one disposition tag: `→ RP-nnn`, `→ RA-nnn`, or
  `→ context-only`.
- At most 3 new RA/RP IDs per entry (the agile action limit); additional lessons must fold
  into an existing ID.
- A metrics line is required; historical entries may use `metrics: not recorded`.
- Entry budget: 30 lines or fewer. Longer prose belongs in a linked artifact.
- Newest first, separated by `---`, with no trailing separator.

### 8.3 Register format

```markdown
# Retro action register

## Open actions

| ID | Action | Owner | Opened | Done when | Carried | Status |
|---|---|---|---|---|---|---|
| RA-013 | Add `nx build` to the UI task checklist | controller | 2026-11-22 | checklist committed | 0 | open |

## Active practices

| ID | Practice | Source | Since | Status |
|---|---|---|---|---|
| RP-004 | Recon before design for integration work | Plan 6 | 2026-11-20 | active |

## Closed actions

| ID | Closed | Evidence |
|---|---|---|
| RA-012 | 2026-11-22 | PR #52 |

## Retired practices

| ID | Retired | Reason |
|---|---|---|
| RP-002 | 2026-11-22 | superseded by RP-007 |
```

- IDs increase monotonically and are never reused.
- RA status is `open | closed | dropped`; RP status is `active | retired`.
- `Carried` increments once per retro that leaves the action open. At 3, the retro must
  close it, drop it with a reason, or escalate it into a plan task; the validator rejects a
  fourth carry.
- A closed action needs a date and evidence (commit, PR, or file path). A retired practice
  needs a date and a reason.
- The hot register contains only open RAs and active RPs; everything else lives in the two
  bottom tables.

### 8.4 Archive and index

- Hot cap: **3 entries**. At retro-write time the oldest entry beyond 3 is rotated out.
- `retro-rotate.ts` refuses to archive an entry unless every bullet has a disposition tag.
- Archive: `retro/archive/<year>.md`, newest first, same template as the hot record.
- `INDEX.md` gains one line per retro, newest first:
  `2026-11-22 · Plan 7 · PR #52 · <headline> · RA-013, RP-004`
- An entry lives in exactly one place; the validator rejects duplicate plan keys across hot
  and archive.

### 8.5 Briefing — the read surface

`npx tsx tools/retro-brief.ts` prints at most 50 lines:

```text
# Retrospective brief — 2026-11-22

## Active practices (obey)
- RP-003 UI work closes with a production build. (since 2026-10-20)

## Open actions
- RA-013 Add `nx build` to the UI checklist — owner: controller, carried 0

## Last retro
Plan 6 — <headline>

## Archive
12 entries in retro/archive/2026.md. Search: `npx tsx tools/retro-brief.ts --topic <keywords>`
```

`--topic kw1,kw2` greps the hot record and the archive and prints at most five matching
bullets with `file:line` and the owning entry heading.

### 8.6 Planning gate

1. `AGENTS.md` requires running `retro-brief.ts` before invoking the planning skill and
   pasting its output into the plan's `## Retrospective compliance` section.
2. `plan-template.md` contains:

```markdown
## Retrospective compliance

Brief run: 2026-11-22 (`npx tsx tools/retro-brief.ts`)

| ID | Kind | Disposition | Where |
|---|---|---|---|
| RP-003 | practice | applied | Task 5 |
| RA-013 | action | deferred — outside this plan's scope | — |
```

3. Every RA/RP open on the plan's date must appear. `deferred` requires a reason.
4. `retro-validate.ts` computes the required set from the register (opened on or before the
   plan date, and not closed before it) and fails on a missing ID or an empty reason.

### 8.7 ROADMAP join

- `ROADMAP.md` gains a `Retro` column keyed by plan number, for example `2026-11-22/Plan 7`.
- Every row marked `done` must resolve to an entry in the hot record or the archive, or
  carry `retro: exempt — <reason>`.
- This closes the loop mechanically: a merged plan without a retrospective fails CI.

### 8.8 Rulings

- New `docs/superpowers/rulings.md`, append-only, heading
  `## YYYY-MM-DD · Ruling · <task>`.
- The two existing Ruling-only entries and the bare ruling line move there verbatim.
- `AGENTS.md` points at the new file; a retrospective links a ruling by date when relevant.

### 8.9 Per-task micro layer

- No new file. The existing `## Dispatch Ledger` in each plan gains an optional `Lesson`
  column.
- At retro time, entry bullets cite ledger rows (`Tasks 3, 7`) as evidence.
- This is the agreed "both" cadence: task rows during execution, one plan retrospective at
  completion.

### 8.10 Agile elements mapped

| Element | Implementation |
|---|---|
| Prime directive | one header line: judge the process, not the person |
| Follow-up first | `Previous actions reviewed` precedes new content |
| Limited actions | at most 3 new IDs per retrospective |
| Owned actions | owner and done-when required |
| Working agreements | RPs, reviewed every retro as keep/amend/retire |
| Metrics | one line per entry |
| Retro of the retro | every fourth entry adds `### Retro of the retro` (3 bullets max) |

### 8.11 Validation rules (authoritative list)

1. Heading grammar, newest-first order, and unique plan key.
2. Required sections and a `Headline:` line present.
3. Every bullet has exactly one valid disposition tag.
4. Every disposition ID exists in the register.
5. The hot record has at most 3 entries.
6. No plan key appears in both hot and archive; INDEX has exactly one row per entry.
7. Register IDs are unique and monotonic; statuses are valid; a closed RA has a date and
   evidence; a retired RP has a date and reason; `Carried` is at most 3.
8. Plan compliance covers the open set at the plan date; deferrals have reasons.
9. Every ROADMAP `done` row resolves to an entry or an exemption.
10. Rulings headings match the grammar.

The tool exits 1 with one actionable message per violation, and exits 0 with a one-line
summary.

### 8.12 Migration (one-time)

1. Restore the orphan heading as
   `## 2026-11-18 · Plan 5 · showcase-deployment · PR #47`.
2. Normalize the question headings to "What would we like to continue doing?" and "What
   would we like to stop doing?", and update the header contract to match.
3. Add `Headline:` and `metrics: not recorded` to historical entries; do not invent metrics.
4. Extract RPs and RAs from existing bullets, assign IDs, and add disposition tags. The
   proposal is reviewed by the human before commit.
5. Move ruling content to `rulings.md`.
6. Rotate all but the newest 3 entries into `retro/archive/2026.md` and build `INDEX.md`.
7. Seed the register with evidence-based statuses only (`active`, `closed`, `retired` with
   the reason found in the record); anything unknown becomes `active` with a note.
8. Add the ROADMAP `Retro` column; plans without entries get `retro: exempt — pre-system`.
9. Add `## Retrospective compliance` only to new plans; historical plans stay untouched.

## 9. Testing and verification

- Jest specs for the parser and validator (`tools/retro-*.spec.ts`) with fixtures: valid
  hot record, archive, register, and plan, plus one fixture per violation class.
- The CLI is the CI entry point; the workflow also runs the tools Jest project filtered to
  `retro`.
- Workflow: `pull_request` on `docs/superpowers/**`, `tools/retro-*.ts`, `AGENTS.md`, and
  `ROADMAP.md`; Node 24; `npm ci`; run the validator; run the retro specs.
- Manual proof: run the brief and validator on the migrated repository; expect exit 0 and a
  brief of 50 lines or fewer.

## 10. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Format drift | one validator, actionable errors, fixtures per violation |
| Migration misclassifies a lesson | human review of the ID proposal before commit |
| Ceremony outweighs value | 3-action cap, 30-line entry budget, 50-line brief |
| Agent skips the brief | CI rejects the plan; PR template checkbox |
| Parser breaks on Windows line endings | normalize CRLF in the parser; fixture covers it |
| Archive grows unbounded | it is cold; only `--topic` touches it |

## 11. What is left to the builder

- Exact regular expressions, CLI flags, and error text.
- Whether shared parsing lives in `tools/retro-lib.ts`.
- Workflow YAML details (action versions, caching) per repository conventions.
- Jest fixture layout.
- The concrete ID assignment proposal for the migration, presented to the human before
  commit.
