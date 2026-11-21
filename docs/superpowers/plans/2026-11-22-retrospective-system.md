# Retrospective system implementation plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the unbounded retrospective log with a bounded hot record, an ID'd action register, a generated ≤50-line planning brief, and a CI gate that enforces all of it.
**Architecture:** One parser module (`tools/retro-lib.ts`) owns the format; the three CLIs (`retro-brief`, `retro-rotate`, `retro-validate`) consume it so rotation, briefing, and validation cannot disagree about grammar. Tools land first and content migration second, so every migration step is checked by the validator it targets.
**Tech Stack:** Node 24 / TypeScript / tsx CLI / Jest / GitHub Actions.
**Spec:** docs/superpowers/specs/2026-11-22-retrospective-system-design.md

## Global Constraints

- Windows/PowerShell first: run every command from the repo root with `npx`; no shell wrappers.
- Node 24; `tools/` is plain Node/TypeScript and stays off the Nx graph (design §6).
- All CLIs run via `npx tsx` (`npx tsx tools/retro-validate.ts`), matching `validate-manifests.yml`.
- Parsers tolerate CRLF and `·` (U+00B7): every public parse function calls `normalize()` first.
- The separator inside review items and register evidence cells is an em dash (U+2014); regexes accept `[\u2013\u2014-]` because editors normalize it.
- Prettier gates `tools/**/*.ts`: run `npx prettier --check "tools/**/*.ts"` after every task touching `tools/`.
- Conventional commits; work happens on branch `feat/retrospective-system` (already checked out) and ships as a PR — never commit to `main`.
- Historical plans and specs are read-only (design §4): do not edit `docs/superpowers/specs/` or existing files in `docs/superpowers/plans/`.

## Review Focus

1. **CRLF + `·` parsing** — identical parse for CRLF and LF input. Test: *Task 1* `parses CRLF and LF input identically`.
2. **Disposition tags** — exactly one `→ RP-nnn|RA-nnn|context-only` per bullet; missing, doubled, or malformed tags error with file, line, and bullet text. Tests: *Task 1* `rejects a bullet without a disposition tag`, `rejects a bullet with two disposition tags`, `rejects a malformed disposition tag`.
3. **Plan date resolution** — filename prefix wins; a contradictory `**Date:**` header is an error, never silently ignored. Test: *Task 3* `rejects a plan whose Date header contradicts its filename`.
4. **Register row integrity** — unknown status, missing owner, or missing done-when errors name the row ID. Tests: *Task 1* `rejects a row missing owner or done-when`, *Task 2* `rejects an unknown RA status naming the row ID`, `rejects a row with a fourth carry`.
5. **`--topic` with regex metacharacters** — literal substrings, never regexes, never throws. Test: *Task 4* `treats regex metacharacters as literal text`.

---

### Task 1: `tools/retro-lib.ts` — types and parsers

**Files:** Create `tools/retro-lib.ts`, `tools/retro-lib.spec.ts`.

**Interfaces:**
- Consumes: nothing.
- Produces: `normalize(text: string): string` (`\r\n` and lone `\r` → `\n`); `parseEntry(text: string): Entry | ParseError[]`; `parseRegister(text: string): Register | ParseError[]`; `parseIndex(text: string): IndexRow[]`; `parsePlanCompliance(text: string): ComplianceTable | ParseError[]`; `planDateFromFile(path: string): string | null`; plus `splitEntryBlocks(text: string): Array<{ text: string; startLine: number }>`, `isParseError(v: unknown): v is ParseError[]`, `formatIndexRow(entry: Entry): string`, `ADOPTION_DATE = '2026-11-22'`.
- Types (shapes per design §8.2–8.5, exported):
  - `ParseError = { file?: string; line: number; message: string }`; `Disposition = { id?: string; contextOnly: boolean }`; `Bullet = { text: string; disposition: Disposition }`.
  - `SectionTitle = 'Previous actions reviewed' | 'What went well?' | 'What would we like to continue doing?' | 'What would we like to stop doing?' | 'Metrics' | 'Retro of the retro'`; `Section = { title: SectionTitle; bullets: Bullet[] }`.
  - `ReviewItem = { id: string; status: 'closed' | 'kept' | 'amended' | 'retired' | 'carried'; note?: string }`.
  - `Entry = { date: string; planKey: string; slug: string; prNumber: number | null; headline: string; reviewed: ReviewItem[]; sections: Section[]; metrics: string; migrated: boolean; line: number }`.
  - `OpenAction = { id: string; action: string; owner: string; opened: string; doneWhen: string; carried: number; status: 'open' }`; `ActivePractice = { id: string; practice: string; source: string; since: string; status: 'active' }`; `ClosedAction = { id: string; outcome: 'closed' | 'dropped'; date: string; evidence: string }`; `RetiredPractice = { id: string; retired: string; reason: string }`.
  - `Register = { openActions: OpenAction[]; practices: ActivePractice[]; closedActions: ClosedAction[]; retiredPractices: RetiredPractice[] }`; `IndexRow = { date: string; planKey: string; prNumber: number | null; headline: string; ids: string[]; line: number }`.
  - `ComplianceRow = { id: string; kind: 'practice' | 'action'; disposition: 'applied' | 'deferred'; where: string; reason?: string }`; `ComplianceTable = { briefRun: string | null; rows: ComplianceRow[] }`.
- Grammar (implement exactly): heading `/^## (\d{4}-\d{2}-\d{2})\s*·\s*(Plan \d+|Ad-hoc)\s*·\s*([a-z0-9-]+)(?:\s*·\s*PR #(\d+))?$/`; review item `/^- ((?:RP|RA)-\d{3}) [\u2013\u2014-] (closed|kept|amended|retired|carried)(?: [\u2013\u2014-] (.+))?$/`; a bullet needs exactly one `→` followed by a trailing `(RP-\d{3}|RA-\d{3}|context-only)`; migrated marker `/^\*\*migrated:\*\* true$/i`; metrics is `metrics: not recorded` or a `tasks … · retries … · escaped defects … · review …` line; register tables are read by section heading plus header row, cells trimmed, empty cell = error; `planDateFromFile` returns the basename's `YYYY-MM-DD` prefix or `null`. `Previous actions reviewed` is optional to the parser (validator rule 2 enforces it); the three question sections and `Metrics` are required.

- [ ] **Step 1: Write the failing spec** — create `tools/retro-lib.spec.ts`:

```ts
import { normalize, parseEntry, parseIndex, parseRegister, planDateFromFile } from './retro-lib';

const entry = [
  '## 2026-11-22 · Plan 7 · retrospective-system · PR #52',
  '**Headline:** A bounded brief beats a growing log.',
  '### Previous actions reviewed',
  '- RA-012 - closed - evidence: PR #52',
  '- RP-003 - kept',
  '### What went well?',
  '- Parsing landed first → RP-004',
  '- Recon paid off → context-only',
  '### What would we like to continue doing?',
  '- Spec before parser → RP-004',
  '### What would we like to stop doing?',
  '- Blind reruns → RA-013',
  '### Metrics',
  'tasks 10 · retries 1 · escaped defects 0 · review 0C/0I/0m',
].join('\n');

const register = [
  '# Retro action register',
  '## Open actions',
  '| ID | Action | Owner | Opened | Done when | Carried | Status |',
  '|---|---|---|---|---|---|---|',
  '| RA-013 | Add nx build to the UI checklist | controller | 2026-11-22 | checklist committed | 0 | open |',
  '## Active practices',
  '| ID | Practice | Source | Since | Status |',
  '|---|---|---|---|---|',
  '| RP-004 | Recon before design | Plan 6 | 2026-11-20 | active |',
  '## Closed and dropped actions',
  '| ID | Outcome | Date | Evidence or reason |',
  '|---|---|---|---|',
  '| RA-012 | closed | 2026-11-22 | PR #52 |',
  '## Retired practices',
  '| ID | Retired | Reason |',
  '|---|---|---|',
  '| RP-002 | 2026-11-22 | superseded by RP-007 |',
].join('\n');

const errs = (v: unknown) => JSON.stringify(v);

describe('parseEntry', () => {
  it('parses CRLF and LF input identically', () => {
    expect(parseEntry(entry.replace(/\n/g, '\r\n'))).toEqual(parseEntry(entry));
    expect(normalize('a\r\nb\rc')).toBe('a\nb\nc');
  });

  it('parses a valid entry', () => {
    const e = parseEntry(entry);
    if (!('headline' in e)) throw new Error(errs(e));
    expect([e.date, e.planKey, e.slug, e.prNumber]).toEqual(['2026-11-22', 'Plan 7', 'retrospective-system', 52]);
    expect(e.reviewed).toEqual([{ id: 'RA-012', status: 'closed', note: 'evidence: PR #52' }, { id: 'RP-003', status: 'kept' }]);
    expect(e.sections.map((s) => s.title)).toEqual(['Previous actions reviewed', 'What went well?', 'What would we like to continue doing?', 'What would we like to stop doing?', 'Metrics']);
    expect(e.sections[1].bullets[1].disposition).toEqual({ contextOnly: true });
    expect([e.metrics, e.migrated]).toEqual(['tasks 10 · retries 1 · escaped defects 0 · review 0C/0I/0m', false]);
  });

  it('rejects an entry without a headline', () => {
    const e = parseEntry(entry.replace('**Headline:** A bounded brief beats a growing log.\n', ''));
    expect(errs(e)).toMatch(/line 1: missing Headline:/);
  });

  it('rejects a missing required section, naming it', () => {
    const e = parseEntry(entry.replace('### What would we like to stop doing?', '### What to stop'));
    expect(errs(e)).toMatch(/required section "What would we like to stop doing\?"/);
  });

  it('rejects a bullet without a disposition tag', () => {
    const e = parseEntry(entry.replace('- Recon paid off → context-only', '- Recon paid off'));
    expect(errs(e)).toMatch(/line 8: bullet has no disposition tag \(→ RP-nnn, → RA-nnn, or → context-only\)/);
    expect(errs(e)).toMatch(/Recon paid off/);
  });

  it('rejects a bullet with two disposition tags', () => {
    expect(errs(parseEntry(entry.replace('→ context-only', '→ RP-004 → RA-013')))).toMatch(/2 disposition tags, expected exactly 1/);
  });

  it('rejects a malformed disposition tag', () => {
    expect(errs(parseEntry(entry.replace('→ RA-013', '→ RA-13')))).toMatch(/malformed disposition tag/);
  });
});

describe('parseRegister', () => {
  it('parses a valid register', () => {
    const r = parseRegister(register);
    if (!('openActions' in r)) throw new Error(errs(r));
    expect(r.openActions[0]).toEqual({ id: 'RA-013', action: 'Add nx build to the UI checklist', owner: 'controller', opened: '2026-11-22', doneWhen: 'checklist committed', carried: 0, status: 'open' });
    expect(r.practices[0].id).toBe('RP-004');
    expect(r.closedActions[0]).toEqual({ id: 'RA-012', outcome: 'closed', date: '2026-11-22', evidence: 'PR #52' });
    expect(r.retiredPractices[0].id).toBe('RP-002');
  });

  it('rejects an unknown status naming the row ID', () => {
    expect(errs(parseRegister(register.replace('| 0 | open |', '| 0 | wip |')))).toMatch(/RA-013: unknown status "wip"/);
  });

  it('rejects a row missing owner or done-when', () => {
    expect(errs(parseRegister(register.replace('| controller |', '|  |')))).toMatch(/RA-013: missing owner/);
    expect(errs(parseRegister(register.replace('| checklist committed |', '|  |')))).toMatch(/RA-013: missing done-when/);
  });
});

describe('parseIndex and planDateFromFile', () => {
  it('parses index rows with and without a PR number', () => {
    const rows = parseIndex([
      '2026-11-22 · Plan 7 · PR #52 · A bounded brief wins · RA-013, RP-004',
      '2026-11-18 · Plan 5 · Restore the orphan heading · -',
    ].join('\n'));
    expect(rows[0]).toEqual({ date: '2026-11-22', planKey: 'Plan 7', prNumber: 52, headline: 'A bounded brief wins', ids: ['RA-013', 'RP-004'], line: 1 });
    expect([rows[1].prNumber, rows[1].ids]).toEqual([null, []]);
  });

  it('prefers the filename date prefix', () => {
    expect(planDateFromFile('docs/superpowers/plans/2026-12-01-retro-ui.md')).toBe('2026-12-01');
    expect(planDateFromFile('docs/superpowers/plans/notes.md')).toBeNull();
  });
});
```

- [ ] **Step 2: Run it, expect FAIL** — `npx jest --config tools/jest.config.ts --testPathPatternsretro-lib` → `Cannot find module './retro-lib'`.
- [ ] **Step 3: Implement `tools/retro-lib.ts`** — every function starts with `normalize()`. `parseEntry` walks the lines once collecting the heading, headline, `migrated` marker, sections in fixed order (`unexpected section` otherwise), review items, tagged bullets (tag stripped from `text`), and metrics; it returns *all* errors and never throws. `parseRegister` sections on `## `, validates cells and per-table statuses, and checks ID uniqueness and monotonic growth. `parseIndex` splits each non-blank, non-heading line on ` · ` into 5 parts (PR) or 4 (no PR), mapping `-`/`—` to `[]`. `parsePlanCompliance` reads `Brief run:` and the 4-column table. `formatIndexRow` emits `<date> · <planKey> · [PR #<n> · ]<headline> · <ids|->`, IDs deduped, sorted, `context-only` excluded.
- [ ] **Step 4: Run it, expect PASS** — same command → PASS, 12 tests.
- [ ] **Step 5: Prettier** — `npx prettier --check "tools/**/*.ts"` → `All matched files use Prettier code style!`
- [ ] **Step 6: Commit** — `git add tools/retro-lib.ts tools/retro-lib.spec.ts && git commit -m "feat(retro): add retrospective format parsers"`

---

### Task 2: `tools/retro-validate.ts` — entry, register, and hot-cap rules

**Files:** Create `tools/retro-validate.ts`, `tools/retro-validate.spec.ts`, and `tools/fixtures/retro/{valid-hot.md,valid-register.md,bad-heading.md,missing-headline.md,bad-disposition.md,over-cap.md,bad-register.md}`.

**Interfaces:**
- Consumes: `parseEntry`, `parseRegister`, `splitEntryBlocks`, `isParseError` from `./retro-lib`.
- Produces: `main(paths?: string[], opts?: { all?: boolean }): number` (exit 0/1; with `paths` omitted validates `docs/superpowers/retrospectives.md` + `docs/superpowers/retro-actions.md`; each path classified by basename — `retro-actions.md` → register, `INDEX.md` → index, else entry file; violations print to `console.error` as `<path>:<line>: <message>`, success prints `retro: OK (<n> entries, <m> register rows)`); `validateEntries(path: string, text: string): string[]` (rules 1, 2, 3, 5); `validateRegister(path: string, text: string): string[]` (rule 7).

- [ ] **Step 1: Write the failing spec and fixtures** — `valid-register.md` is the Task 1 `register` fixture; `valid-hot.md` is three copies of the Task 1 `entry` with dates/keys `2026-11-22/Plan 7`, `2026-11-20/Plan 6`, `2026-11-18/Plan 5` joined by `\n---\n`; `bad-heading.md` starts `## 2026-11-22 - Plan 7`; `missing-headline.md` drops `**Headline:**`; `bad-disposition.md` drops the tag from `- Recon paid off` and tags `- Blind reruns → RA-099`; `over-cap.md` adds a fourth block; `bad-register.md` sets RA-013's status to `wip` and adds `RA-014` with `Carried` 4.

```ts
import { resolve } from 'path';
import { main } from './retro-validate';

const fixture = (n: string) => resolve(__dirname, 'fixtures', 'retro', n);

function run(name: string, register = 'valid-register.md'): { code: number; out: string } {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  const code = main([fixture(name), fixture(register)]);
  const out = spy.mock.calls.flat().join('\n');
  spy.mockRestore();
  return { code, out };
}

describe('retro-validate: entries, dispositions, register', () => {
  it('exits 0 on a valid hot record and register', () => {
    expect(main([fixture('valid-hot.md'), fixture('valid-register.md')])).toBe(0);
  });

  it('rejects a malformed heading with its line number', () => {
    expect(run('bad-heading.md')).toEqual({ code: 1, out: expect.stringMatching(/bad-heading\.md:1: heading does not match/) });
  });

  it('rejects an entry without a headline', () => {
    const { code, out } = run('missing-headline.md');
    expect(code).toBe(1);
    expect(out).toMatch(/missing-headline\.md:\d+: missing Headline:/);
  });

  it('rejects a missing disposition tag and an unknown disposition ID', () => {
    const { code, out } = run('bad-disposition.md');
    expect(code).toBe(1);
    expect(out).toMatch(/bullet has no disposition tag/);
    expect(out).toMatch(/RA-099: not in the register/);
  });

  it('rejects more than three hot entries', () => {
    expect(run('over-cap.md').out).toMatch(/4 entries in the hot record; cap is 3/);
  });

  it('rejects an unknown RA status naming the row ID', () => {
    const { code, out } = run('valid-hot.md', 'bad-register.md');
    expect(code).toBe(1);
    expect(out).toMatch(/RA-013: unknown status "wip"/);
  });

  it('rejects a row with a fourth carry', () => {
    expect(run('valid-hot.md', 'bad-register.md').out).toMatch(/RA-014: Carried is 4; max is 3/);
  });
});
```

- [ ] **Step 2: Run it, expect FAIL** — `npx jest --config tools/jest.config.ts --testPathPatternsretro-validate` → `Cannot find module './retro-validate'`.
- [ ] **Step 3: Implement rules 1–5 and 7** — rule 1: heading grammar, newest-first order, duplicate plan key within a file. Rule 2: missing/duplicated `Headline:`, missing required sections in order, and (non-`migrated` only) a required `Previous actions reviewed` block plus at most 3 distinct new IDs. Rule 3: parser disposition errors re-emitted with the file name. Rule 4: every `disposition.id` and `reviewed[].id` must exist in the register (`<ID>: not in the register`). Rule 5: more than 3 blocks. Rule 7: duplicate or non-monotonic IDs, unknown statuses, closed/dropped row without date+evidence, retired practice without date+reason, `Carried` > 3. `main` reads files, merges messages, prints the summary, returns 0/1.
- [ ] **Step 4: Run it, expect PASS** — same command → PASS, 7 tests.
- [ ] **Step 5: Prettier** — `npx prettier --check "tools/**/*.ts"` → clean.
- [ ] **Step 6: Commit** — `git add tools/retro-validate.ts tools/retro-validate.spec.ts tools/fixtures/retro && git commit -m "feat(retro): validate entries, dispositions, and register"`

---

### Task 3: `tools/retro-validate.ts` — archive, plan, ROADMAP, rulings

**Files:** Modify `tools/retro-validate.ts`, `tools/retro-validate.spec.ts`; create `tools/fixtures/retro/{plan-with-compliance.md,plan-missing-id.md,plan-deferred-no-reason.md,roadmap-valid.md,roadmap-missing-retro.md,rulings-valid.md,rulings-bad.md}`.

**Interfaces:**
- Consumes: `parseIndex`, `parsePlanCompliance`, `planDateFromFile`, `ADOPTION_DATE` from `./retro-lib`; Task 2 `main`.
- Produces: `validateArchivePair(hot: string, archive: string, index: string): string[]` (rule 6); `validatePlan(path: string, text: string, openIdsAt: (date: string) => string[]): string[]` (rule 8); `validateRoadmap(path: string, text: string, entryKeys: Set<string>): string[]` (rule 9); `validateRulings(path: string, text: string): string[]` (rule 10); `main` gains `--all` (scans `docs/superpowers/plans/*.md`) and classifies `ROADMAP.md` → roadmap, `rulings.md` → rulings, `plans/*.md` → plan.

- [ ] **Step 1: Append the failing tests** to `tools/retro-validate.spec.ts`:

```ts
import { readFileSync } from 'fs';
import { validatePlan, validateRoadmap, validateRulings } from './retro-validate';

const read = (n: string) => readFileSync(fixture(n), 'utf8');
const openAt = (date: string) => (date >= '2026-11-22' ? ['RA-013', 'RP-004'] : []);

describe('retro-validate: plan, roadmap, rulings', () => {
  it('accepts a plan whose compliance covers the open set', () => {
    expect(validatePlan('2026-12-01-brief-ui.md', read('plan-with-compliance.md'), openAt)).toEqual([]);
  });

  it('rejects a plan that omits an open ID', () => {
    expect(validatePlan('2026-12-01-brief-ui.md', read('plan-missing-id.md'), openAt).join('\n')).toMatch(/RP-004 missing from Retrospective compliance/);
  });

  it('rejects a deferral without a reason', () => {
    expect(validatePlan('2026-12-01-brief-ui.md', read('plan-deferred-no-reason.md'), openAt).join('\n')).toMatch(/RA-013 deferred without a reason/);
  });

  it('rejects a plan whose Date header contradicts its filename', () => {
    const text = '**Date:** 2026-11-01\n\n## Retrospective compliance\n';
    expect(validatePlan('2026-12-01-brief-ui.md', text, openAt).join('\n')).toMatch(/Date: 2026-11-01 contradicts filename date 2026-12-01/);
  });

  it('exempts plans dated on or before the adoption date', () => {
    expect(validatePlan('2026-11-22-retrospective-system.md', '# plan\n', openAt)).toEqual([]);
  });

  it('accepts a roadmap whose done rows resolve', () => {
    expect(validateRoadmap('ROADMAP.md', read('roadmap-valid.md'), new Set(['2026-11-18/Plan 5']))).toEqual([]);
  });

  it('rejects a done row with no entry and no exemption', () => {
    const errors = validateRoadmap('ROADMAP.md', read('roadmap-missing-retro.md'), new Set(['2026-11-18/Plan 5']));
    expect(errors.join('\n')).toMatch(/2026-11-19\/Plan 6: no retrospective entry and no "retro: exempt"/);
  });

  it('enforces the rulings heading grammar', () => {
    expect(validateRulings('rulings.md', read('rulings-valid.md'))).toEqual([]);
    expect(validateRulings('rulings.md', read('rulings-bad.md')).join('\n')).toMatch(/heading does not match "## YYYY-MM-DD · Ruling · <task>"/);
  });
});
```

- [ ] **Step 2: Run it, expect FAIL** — `npx jest --config tools/jest.config.ts --testPathPatternsretro-validate` → `validatePlan is not a function`.
- [ ] **Step 3: Write the fixtures** — `plan-with-compliance.md`: `**Date:** 2026-12-01`, `Brief run: 2026-12-01 (npx tsx tools/retro-brief.ts)`, rows `| RP-004 | practice | applied | Task 5 |` and `| RA-013 | action | deferred — outside this plan's scope | — |`; `plan-missing-id.md` drops the RP-004 row; `plan-deferred-no-reason.md` has `| RA-013 | action | deferred | — |`. `roadmap-valid.md`:

```markdown
| Plan | Status | Retro |
|---|---|---|
| 2026-11-18/Plan 5 | done | 2026-11-18/Plan 5 |
| 2026-11-19/Plan 6 | in progress | |
```

`roadmap-missing-retro.md` marks Plan 6 `done` with an empty Retro cell; `rulings-valid.md` is `## 2026-11-22 · Ruling · retrospective-system`; `rulings-bad.md` is `## Ruling: something`.

- [ ] **Step 4: Implement rules 6, 8, 9, 10 and `--all`** — rule 6: plan key in both hot and archive, or INDEX rows not matching `formatIndexRow` of the archived entries (count and `date · planKey`). Rule 8: date from `planDateFromFile`; if a `**Date:**` header exists and differs, emit the contradiction error and stop; at or before `ADOPTION_DATE` return `[]`; `main` builds `openIdsAt(date)` from the register — an ID is open at `date` when it sits in `Open actions` or `Active practices` with `opened`/`since` at or before the date, or in `Closed and dropped actions` / `Retired practices` with a date after it (it was open then); otherwise every `openIdsAt(date)` ID must be in the table with a non-empty `Where`, and `deferred` must carry a non-empty reason. Rule 9: for each `done` ROADMAP row the `Retro` cell must be in `entryKeys` or start with `retro: exempt —`. Rule 10: every `## ` heading matches `/^## \d{4}-\d{2}-\d{2}\s*·\s*Ruling\s*·\s*.+$/`.
- [ ] **Step 5: Run it, expect PASS** — same command → PASS, 15 tests.
- [ ] **Step 6: Prettier, then commit** — `npx prettier --check "tools/**/*.ts"` → clean; `git add tools/retro-validate.ts tools/retro-validate.spec.ts tools/fixtures/retro && git commit -m "feat(retro): validate archive, plans, roadmap, and rulings"`

---

### Task 4: `tools/retro-brief.ts` — the planning read surface

**Files:** Create `tools/retro-brief.ts`, `tools/retro-brief.spec.ts`.

**Interfaces:**
- Consumes: `parseRegister`, `parseEntry`, `splitEntryBlocks` from `./retro-lib`.
- Produces: `buildBrief(input: { today: string; hot: string; register: string; archiveText: string; archiveName: string }): string` (≤50 lines, §8.5 order); `searchTopic(keywords: string[], files: Array<{ path: string; text: string }>): Array<{ file: string; line: number; heading: string; text: string }>` (case-insensitive literal `includes`, max 5); `main(argv?: string[]): number` (parses `--topic kw1,kw2`).

- [ ] **Step 1: Write the failing spec** — create `tools/retro-brief.spec.ts`:

```ts
import { buildBrief, searchTopic } from './retro-brief';

const register = [
  '## Open actions',
  '| ID | Action | Owner | Opened | Done when | Carried | Status |',
  '|---|---|---|---|---|---|---|',
  '| RA-013 | Add nx build to the UI checklist | controller | 2026-11-22 | checklist committed | 1 | open |',
  '## Active practices',
  '| ID | Practice | Source | Since | Status |',
  '|---|---|---|---|---|',
  '| RP-004 | Recon before design | Plan 6 | 2026-11-20 | active |',
].join('\n');

const hot = [
  '## 2026-11-22 · Plan 7 · retrospective-system · PR #52',
  '**Headline:** A bounded brief beats a growing log.',
  '### What went well?',
  '- Parsing first → RP-004',
  '### What would we like to continue doing?',
  '- Spec before parser → RP-004',
  '### What would we like to stop doing?',
  '- Blind reruns → RA-013',
  '### Metrics',
  'metrics: not recorded',
].join('\n');

describe('buildBrief', () => {
  it('lists practices, open actions, and the last headline within 50 lines', () => {
    const brief = buildBrief({ today: '2026-11-22', hot, register, archiveText: '', archiveName: '2026.md' });
    expect(brief.split('\n').length).toBeLessThanOrEqual(50);
    expect(brief).toContain('RP-004 Recon before design — since 2026-11-20');
    expect(brief).toContain('RA-013 Add nx build to the UI checklist — owner: controller, carried 1');
    expect(brief).toContain('Plan 7 — A bounded brief beats a growing log.');
    expect(brief).toContain('npx tsx tools/retro-brief.ts --topic');
  });
});

describe('searchTopic', () => {
  const files = [{ path: 'retrospectives.md', text: '## 2026-11-22 · Plan 7 · retrospective-system · PR #52\n\n- Learned c++ templates → context-only\n' }];

  it('finds a literal substring with file, line, and owning heading', () => {
    expect(searchTopic(['c++'], files)).toEqual([
      { file: 'retrospectives.md', line: 3, heading: '2026-11-22 · Plan 7 · retrospective-system · PR #52', text: 'Learned c++ templates → context-only' },
    ]);
  });

  it('treats regex metacharacters as literal text', () => {
    expect(searchTopic(['c.*'], files)).toEqual([]);
    expect(searchTopic(['('], files)).toEqual([]);
    expect(() => searchTopic(['a)b', '[', '\\'], files)).not.toThrow();
  });

  it('caps results at five', () => {
    const many = { path: 'x.md', text: Array.from({ length: 9 }, () => '- needle → context-only').join('\n') };
    expect(searchTopic(['needle'], [many])).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Run it, expect FAIL** — `npx jest --config tools/jest.config.ts --testPathPatternsretro-brief` → `Cannot find module './retro-brief'`.
- [ ] **Step 3: Implement** — `buildBrief` emits `# Retrospective brief — <today>`, `## Active practices (obey)`, `## Open actions` (`carried N`), `## Last retro` (`<planKey> — <headline>`), `## Archive` (`<n> entries in retro/archive/<name>.` plus the `--topic` hint); empty lists print `- none`; trim sections rather than exceed 50 lines. `searchTopic` lowercases both sides, uses only `String.prototype.includes`, tracks the last `## ` heading per file, stops at 5 hits. `main` reads `docs/superpowers/retrospectives.md`, `docs/superpowers/retro-actions.md`, `docs/superpowers/retro/archive/2026.md` (missing = empty) and prints the brief or the hits. When `parseEntry` returns errors, fall back to the raw `## ` heading and `**Headline:**` line so the brief never crashes.
- [ ] **Step 4: Run it, expect PASS** — same command → PASS, 4 tests.
- [ ] **Step 5: Prettier** — `npx prettier --check "tools/**/*.ts"` → clean.
- [ ] **Step 6: Commit** — `git add tools/retro-brief.ts tools/retro-brief.spec.ts && git commit -m "feat(retro): print the planning brief and topic search"`

---

### Task 5: `tools/retro-rotate.ts` — gated rotation

**Files:** Create `tools/retro-rotate.ts`, `tools/retro-rotate.spec.ts`.

**Interfaces:**
- Consumes: `parseEntry`, `splitEntryBlocks`, `formatIndexRow`, `isParseError` from `./retro-lib`.
- Produces: `rotate(input: { hot: string; archive: string; index: string; year: string; today: string; register?: string }): { hot: string; archive: string; index: string; rotated: Entry | null; retiredRegister: string[] } | ParseError[]`; `refuseReason(entry: Entry): string | null`; `main(argv?: string[]): number`.

- [ ] **Step 1: Write the failing spec** — create `tools/retro-rotate.spec.ts`:

```ts
import { rotate } from './retro-rotate';

const block = (date: string, plan: string) =>
  [
    `## ${date} · ${plan} · demo-slug`,
    `**Headline:** Lesson for ${plan}.`,
    '### What went well?',
    '- Something worked → RP-004',
    '### What would we like to continue doing?',
    '- Keep the spec first → RP-004',
    '### What would we like to stop doing?',
    '- Skipping builds → RA-013',
    '### Metrics',
    'metrics: not recorded',
  ].join('\n');

const four = [
  ['Plan 7', '2026-11-22'],
  ['Plan 6', '2026-11-20'],
  ['Plan 5', '2026-11-18'],
  ['Plan 4', '2026-11-10'],
].map(([p, d]) => block(d, p)).join('\n---\n');
const three = four.split('\n---\n').slice(0, 3).join('\n---\n');

describe('rotate', () => {
  it('archives the oldest entry and prepends its INDEX row', () => {
    const r = rotate({ hot: four, archive: '', index: '', year: '2026', today: '2026-11-22' });
    if (Array.isArray(r)) throw new Error(JSON.stringify(r));
    expect(r.rotated?.planKey).toBe('Plan 4');
    expect(r.hot).toContain('Plan 7');
    expect(r.hot).not.toContain('Plan 4');
    expect(r.archive).toContain('## 2026-11-10 · Plan 4');
    expect(r.index.trim()).toBe('2026-11-10 · Plan 4 · Lesson for Plan 4. · RA-013, RP-004');
  });

  it('refuses an entry with an undisposed bullet', () => {
    const bad = four.replace('- Skipping builds → RA-013', '- Skipping builds');
    expect(JSON.stringify(rotate({ hot: bad, archive: '', index: '', year: '2026', today: '2026-11-22' }))).toMatch(/Plan 4: bullet has no disposition tag/);
  });

  it('is a no-op when three entries are hot', () => {
    const r = rotate({ hot: three, archive: '', index: '', year: '2026', today: '2026-11-22' });
    if (Array.isArray(r)) throw new Error(JSON.stringify(r));
    expect([r.rotated, r.hot, r.index]).toEqual([null, three, '']);
  });

  it('rotates closed and retired register rows dated before this year', () => {
    const reg = [
      '## Closed and dropped actions',
      '| ID | Outcome | Date | Evidence or reason |',
      '|---|---|---|---|',
      '| RA-012 | closed | 2025-12-01 | PR #20 |',
      '## Retired practices',
      '| ID | Retired | Reason |',
      '|---|---|---|',
      '| RP-002 | 2026-01-05 | superseded by RP-004 |',
    ].join('\n');
    const r = rotate({ hot: four, archive: '', index: '', year: '2026', today: '2026-11-22', register: reg });
    if (Array.isArray(r)) throw new Error(JSON.stringify(r));
    expect(r.retiredRegister.join('\n')).toMatch(/RA-012/);
    expect(r.retiredRegister.join('\n')).not.toMatch(/RP-002/);
  });
});
```

- [ ] **Step 2: Run it, expect FAIL** — `npx jest --config tools/jest.config.ts --testPathPatternsretro-rotate` → `Cannot find module './retro-rotate'`.
- [ ] **Step 3: Implement** — `rotate` parses every block, returns parse errors plus `<planKey>: <refuseReason>` for any undisposed bullet, and otherwise drops the last block, prepends it to `archive` (newest first, `---` separated, no trailing separator), and prepends `formatIndexRow` to `index` unless a row with the same date+planKey exists (idempotency). `main` reads `docs/superpowers/retrospectives.md`, `docs/superpowers/retro/archive/<year>.md`, `docs/superpowers/retro/archive/INDEX.md`, writes them back with `\n`, and moves `Closed and dropped actions` / `Retired practices` rows dated before this year into `docs/superpowers/retro/archive/register-<year>.md` (returned as `retiredRegister`). Exit 1 on error/refusal, else 0, printing `rotated <date> · <planKey> → <archive>` per rotation.
- [ ] **Step 4: Run it, expect PASS** — same command → PASS, 4 tests.
- [ ] **Step 5: Prettier** — `npx prettier --check "tools/**/*.ts"` → clean.
- [ ] **Step 6: Commit** — `git add tools/retro-rotate.ts tools/retro-rotate.spec.ts && git commit -m "feat(retro): rotate hot entries into the archive"`

---

### Task 6: `docs/superpowers/retro-actions.md` — curated register

**Files:** Create `docs/superpowers/retro-actions.md` (the only file written in this task).

**Interfaces:**
- Consumes: design §8.3 format; Task 1 `parseRegister` must return `Register`, not errors.
- Produces: RA-001…RA-006 and RP-001…RP-006, cited by Task 7 dispositions; sections exactly `## Open actions`, `## Active practices`, `## Closed and dropped actions`, `## Retired practices` with the §8.3 headers.

- [ ] **Step 1: Curate** — read all of `docs/superpowers/retrospectives.md`, list every bullet, group recurring behaviour into RPs and one-off fixes into RAs. Target ~6 RPs and ~6 RAs, most in the two bottom tables with evidence quoted from the record ("Run `gradlew build` in-task" → an RA closed by the PR that added the gate; "recon before design" → an RP whose `Since` is the plan that first recorded it). IDs are three digits, contiguous from 001, never reused.
- [ ] **Step 2: Write the draft** — §8.3 layout; `Carried` 0; closed evidence is a PR number, commit, or file path present in the record; a retired practice's reason names the superseding practice; anything whose state the record cannot establish goes to the hot tables as `open`/`active` with a one-clause note — never invent a close (design §8.12.7).
- [ ] **Step 3: Self-check** — `npx tsx -e "import {readFileSync} from 'fs'; import {parseRegister} from './tools/retro-lib'; const r = parseRegister(readFileSync('docs/superpowers/retro-actions.md','utf8')); console.log(Array.isArray(r) ? JSON.stringify(r) : 'register OK');"` → `register OK`.
- [ ] **Step 4: CHECKPOINT: present the proposed register to the human for approval before committing**

Print the full curated table (ID · practice/action · status · evidence or reason, all ~12 rows) in the response and stop. Do not commit, do not start Task 7, until the human approves or amends; apply every requested change and re-run Step 3 (`register OK`).

- [ ] **Step 5: Commit** — `git add docs/superpowers/retro-actions.md && git commit -m "docs(retro): seed the curated action register"`

---

### Task 7: migrate `docs/superpowers/retrospectives.md`, extract `rulings.md`

**Files:** Modify `docs/superpowers/retrospectives.md`; create `docs/superpowers/rulings.md`.

**Interfaces:**
- Consumes: RP/RA IDs from Task 6; `parseEntry` from Task 1.
- Produces: every historical entry parseable with zero errors, carrying `**Headline:**`, `**migrated:** true`, `metrics: not recorded`, and exactly one disposition per bullet; `rulings.md` in the `## YYYY-MM-DD · Ruling · <task>` grammar.

- [ ] **Step 1: Baseline** — `npx tsx tools/retro-validate.ts` → exit 1 listing the orphan heading, missing headlines, missing disposition tags, and the unreachable register.
- [ ] **Step 2: Headings** — insert `## 2026-11-18 · Plan 5 · showcase-deployment · PR #47` above the headingless body at lines 38–53; rewrite every entry heading to the new grammar — `## YYYY-MM-DD · Plan <N> · <slug>` for numbered plans, `## YYYY-MM-DD · Ad-hoc · <slug>` for un-numbered task entries — keeping each entry's date and adding a PR number only where the record states one; rename every keep-question variant to `### What would we like to continue doing?` and every stop-question variant to `### What would we like to stop doing?`; update the header contract to the same three questions and add `> Prime directive: judge the process, not the person.`
- [ ] **Step 3: Headline, flag, metrics** — per entry add `**Headline:** <one sentence taken from its own text>`, then `**migrated:** true`, and replace the metrics block with `metrics: not recorded`; invent no numbers or prose.
- [ ] **Step 4: Dispositions** — append exactly one `→ RP-nnn` / `→ RA-nnn` (from Task 6) or `→ context-only` to every bullet; entries stay exempt from `Previous actions reviewed` (design §8.2).
- [ ] **Step 5: Rulings** — create `docs/superpowers/rulings.md` (`# Rulings`) and move the two Ruling-only entries and the bare ruling paragraph verbatim under `## YYYY-MM-DD · Ruling · <task>` headings taken from their surrounding entries; leave `Rulings for this period: see docs/superpowers/rulings.md.` where they were.
- [ ] **Step 6: Verify** — `npx tsx tools/retro-validate.ts` → exit 0, or exit 1 naming only `4 entries in the hot record; cap is 3` (Task 8 fixes it); parsing the hot file with `parseEntry` must yield zero parse errors.
- [ ] **Step 7: Commit** — `git add docs/superpowers/retrospectives.md docs/superpowers/rulings.md && git commit -m "docs(retro): migrate the retrospective record to the new format"`

---

### Task 8: rotate the record, build the archive

**Files:** Modify `docs/superpowers/retrospectives.md`; create `docs/superpowers/retro/archive/2026.md`, `docs/superpowers/retro/archive/INDEX.md`.

**Interfaces:**
- Consumes: `main` from `tools/retro-rotate.ts` and `tools/retro-validate.ts`.
- Produces: a hot record of exactly the 3 newest entries, an archive of the rest newest-first, an INDEX with one row per archived entry.

- [ ] **Step 1: Rotate** — `npx tsx tools/retro-rotate.ts` → one `rotated <date> · <planKey> → retro/archive/2026.md` line per rotated entry, exit 0.
- [ ] **Step 2: Idempotency** — run it again → exit 0, no `rotated` lines.
- [ ] **Step 3: Count** — `npx tsx -e "import {readFileSync} from 'fs'; import {splitEntryBlocks} from './tools/retro-lib'; for (const f of ['docs/superpowers/retrospectives.md','docs/superpowers/retro/archive/2026.md']) console.log(f, splitEntryBlocks(readFileSync(f,'utf8')).length);"` → hot `3`, archive `5` or more.
- [ ] **Step 4: Validate** — `npx tsx tools/retro-validate.ts` → exit 0, `retro: OK (…)`.
- [ ] **Step 5: Commit** — `git add docs/superpowers/retrospectives.md docs/superpowers/retro && git commit -m "docs(retro): archive all but the newest three entries"`

---

### Task 9: `plan-template.md` and the `AGENTS.md` contract

**Files:** Create `docs/superpowers/plan-template.md`; modify `AGENTS.md` (retrospective/planning sections only — repo map, CI gates, demo commands, branching, do-not-touch stay byte-identical).

**Interfaces:**
- Consumes: design §8.6 table, §8.9 ledger column, §8.8 rulings pointer.
- Produces: a template containing a `## Retrospective compliance` heading and the 4-column table; an `AGENTS.md` retrospective section naming the brief, compliance table, register, rotation, and `rulings.md`.

- [ ] **Step 1: Write the template** — `docs/superpowers/plan-template.md`: `# <Plan title>`, `**Date:** YYYY-MM-DD`, `**Branch:** feat/<slug>`, `## Global Constraints`, then:

```markdown
## Retrospective compliance

Brief run: YYYY-MM-DD (`npx tsx tools/retro-brief.ts`)

| ID | Kind | Disposition | Where |
|---|---|---|---|
| RP-nnn | practice | applied | Task N |
| RA-nnn | action | deferred — <reason> | — |
```

plus `## Tasks` (the `### Task N:` / `**Files:**` / `**Interfaces:**` / checkbox shape) and `## Dispatch Ledger`:

```markdown
| Task | Status | Notes | Lesson |
|---|---|---|---|
```

- [ ] **Step 2: Rewrite the `AGENTS.md` retrospective section** — replace the retrospective bullet and the "Plan retrospective (binding)" section with "Retrospectives and rulings (binding)": (1) before planning run `npx tsx tools/retro-brief.ts` and paste its output into the plan's `## Retrospective compliance`, with every open RA/RP as `applied` or `deferred — <reason>`; (2) during execution each plan's `## Dispatch Ledger` gains one row per task with the optional `Lesson` column; (3) at completion write one entry (headline, previous actions reviewed, the three questions, metrics, one disposition per bullet, at most 3 new IDs), update `retro-actions.md`, then run `npx tsx tools/retro-rotate.ts` so the hot record stays at 3 entries; (4) `Ruling:` lines go to `docs/superpowers/rulings.md`, never into the retro record; (5) the retro header carries the prime directive line.
- [ ] **Step 3: Verify** — `npx prettier --check "docs/superpowers/plan-template.md" "AGENTS.md"` → `All matched files use Prettier code style!`; if either file sits outside the repo's prettier scope, note that in the task notes instead of reformatting.
- [ ] **Step 4: Commit** — `git add docs/superpowers/plan-template.md AGENTS.md && git commit -m "docs(retro): add the plan template and the planning contract"`

---

### Task 10: `docs/superpowers/ROADMAP.md` — the `Retro` column

**Files:** Modify `docs/superpowers/ROADMAP.md`.

**Interfaces:**
- Consumes: `validateRoadmap` semantics from Task 3; keys shaped `<date>/<PlanKey>`.
- Produces: a ROADMAP whose every `done` row resolves to an entry key or carries `retro: exempt — pre-system`.

- [ ] **Step 1: Read and list** — read `docs/superpowers/ROADMAP.md` and record each row's plan identity and status.
- [ ] **Step 2: Add and fill the column** — append `| Retro |` to the header and a cell to every row: `done` rows get the entry key (`2026-11-18/Plan 5`) when an entry exists in hot or archive, else `retro: exempt — pre-system`; non-`done` rows stay empty.
- [ ] **Step 3: Verify** — `npx tsx tools/retro-validate.ts --all` → exit 0, no `no retrospective entry and no "retro: exempt"` message.
- [ ] **Step 4: Commit** — `git add docs/superpowers/ROADMAP.md && git commit -m "docs(retro): join done roadmap rows to retro entries"`

---

### Task 11: `.github/workflows/validate-retrospectives.yml`

**Files:** Create `.github/workflows/validate-retrospectives.yml`.

**Interfaces:**
- Consumes: `npx tsx tools/retro-validate.ts --all`, `npx jest --config tools/jest.config.ts --testPathPatternsretro`; action versions from `validate-manifests.yml` (`actions/checkout@v4`, `actions/setup-node@v4`).
- Produces: a path-filtered pull-request gate.

- [ ] **Step 1: Write the workflow**

```yaml
name: Validate retrospectives

on:
  pull_request:
    paths:
      - 'docs/superpowers/**'
      - 'tools/retro-*.ts'
      - 'tools/fixtures/retro/**'
      - 'AGENTS.md'
      - 'ROADMAP.md'

jobs:
  validate-retrospectives:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Validate retrospectives
        run: npx tsx tools/retro-validate.ts --all

      - name: Run retro tool specs
        run: npx jest --config tools/jest.config.ts --testPathPatternsretro
```

- [ ] **Step 2: Shape check** — `npx tsx -e "import {readFileSync} from 'fs'; const y = readFileSync('.github/workflows/validate-retrospectives.yml','utf8'); if (!/pull_request:/.test(y) || !/node-version: '24'/.test(y) || !/retro-validate\.ts --all/.test(y)) throw new Error('workflow shape wrong'); console.log('workflow OK');"` → `workflow OK`.
- [ ] **Step 3: Run its commands** — `npx tsx tools/retro-validate.ts --all` → exit 0; `npx jest --config tools/jest.config.ts --testPathPatternsretro` → all retro suites PASS.
- [ ] **Step 4: Commit** — `git add .github/workflows/validate-retrospectives.yml && git commit -m "ci(retro): gate retrospective structure on pull requests"`

---

### Task 12: end-to-end verification

**Files:** Modify only if a check exposes a real defect — fix in the owning tool or document, re-run its spec, commit as `fix(retro): …`.

**Interfaces:**
- Consumes: everything above.
- Produces: evidence for each design §9 claim.

- [ ] **Step 1: Validator** — `npx tsx tools/retro-validate.ts` → exit 0, one-line summary.
- [ ] **Step 2: Brief budget** — `npx tsx tools/retro-brief.ts | Measure-Object -Line` → `Lines : <n>` with `n` of 50 or less.
- [ ] **Step 3: Topic search on the migrated record** — `npx tsx tools/retro-brief.ts --topic build,carried` → 5 or fewer `file:line` hits, exit 0, no regex error.
- [ ] **Step 4: Prettier and the tools suite** — `npx prettier --check "tools/**/*.ts"` → clean; `npx jest --config tools/jest.config.ts` → all suites PASS (retro plus pre-existing tools specs).
- [ ] **Step 5: Hygiene** — `git status --porcelain` → empty; `git log --oneline main..HEAD` → only conventional-commit task commits.
- [ ] **Step 6: Pull request** — `git push -u origin feat/retrospective-system`, open a PR against `main` pasting the final validator and brief output; merge only after the Task 6 approval and a green `Validate retrospectives` run.
