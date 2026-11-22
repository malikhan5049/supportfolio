import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import {
  main,
  validateArchivePair,
  validateEntries,
  validatePlan,
  validateRegister,
  validateRegisterCap,
  validateRoadmap,
  validateRulings,
} from './retro-validate';

const fixture = (n: string) => resolve(__dirname, 'fixtures', 'retro', n);

function run(name: string, register = 'valid-register.md'): { code: number; out: string } {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  const code = main([fixture(name), fixture(register)]);
  const out = spy.mock.calls.flat().join('\n');
  spy.mockRestore();
  return { code, out };
}

const adHocEntry = (date: string, slug: string) =>
  [
    `## ${date} · Ad-hoc · ${slug}`,
    '**Headline:** Lesson from the ad-hoc run.',
    '### What went well?',
    '- Something worked → RP-004',
    '### What would we like to continue doing?',
    '- Keep the spec first → RP-004',
    '### What would we like to stop doing?',
    '- Skipping builds → RA-013',
    '### Metrics',
    'tasks 1 · retries 0 · escaped defects 0 · review 0C/0I/0m',
  ].join('\n');

/** Rule 6's duplicate finding only; the INDEX-count findings an empty INDEX raises are not the subject. */
const duplicatePlanKey = (violations: string[]) =>
  violations.filter((line) => /appears in both the hot record and the archive/.test(line));

describe('retro-validate: ad-hoc entries join by slug', () => {
  it('flags a duplicate only when the same ad-hoc slug sits in both places', () => {
    const distinct = duplicatePlanKey(
      validateArchivePair(adHocEntry('2026-11-20', 'a'), adHocEntry('2026-11-13', 'b'), ''),
    );
    const same = duplicatePlanKey(
      validateArchivePair(adHocEntry('2026-11-13', 'a'), adHocEntry('2026-11-13', 'a'), ''),
    );

    expect([distinct, same]).toEqual([
      [],
      ['plan key "Ad-hoc/a" appears in both the hot record and the archive'],
    ]);
  });
});

describe('retro-validate: entries, dispositions, register', () => {
  it('exits 0 on a valid hot record and register', () => {
    expect(main([fixture('valid-hot.md'), fixture('valid-register.md')])).toBe(0);
  });

  it('rejects a malformed heading with its line number', () => {
    expect(run('bad-heading.md')).toEqual({
      code: 1,
      out: expect.stringMatching(/bad-heading\.md:1: heading does not match/),
    });
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

describe('retro-validate: references are never skipped and the cap never lifts', () => {
  it('exits 1 when entry files are validated without a register', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const code = main([fixture('valid-hot.md')]);
    const out = spy.mock.calls.flat().join('\n');
    spy.mockRestore();
    expect(code).toBe(1);
    expect(out).toMatch(/valid-hot\.md:1: no register supplied; cross-file ID checks were skipped/);
  });

  it('applies the hot cap even when main is asked for all entries', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const code = main([fixture('over-cap.md'), fixture('valid-register.md')], { all: true });
    const out = spy.mock.calls.flat().join('\n');
    spy.mockRestore();
    expect(code).toBe(1);
    expect(out).toMatch(/4 entries in the hot record; cap is 3/);
  });

  it('keeps the cap in the two-argument validateEntries form', () => {
    const path = fixture('over-cap.md');
    expect(validateEntries(path, readFileSync(path, 'utf8'))).toEqual([
      expect.stringMatching(/4 entries in the hot record; cap is 3/),
    ]);
  });
});

const read = (n: string) => readFileSync(fixture(n), 'utf8');
const openAt = (date: string) => (date >= '2026-11-22' ? ['RA-013', 'RP-004'] : []);

describe('retro-validate: plan, roadmap, rulings', () => {
  it('accepts a plan whose compliance covers the open set', () => {
    expect(validatePlan('2026-12-01-brief-ui.md', read('plan-with-compliance.md'), openAt)).toEqual(
      [],
    );
  });

  it('rejects a plan that omits an open ID', () => {
    expect(
      validatePlan('2026-12-01-brief-ui.md', read('plan-missing-id.md'), openAt).join('\n'),
    ).toMatch(/RP-004 missing from Retrospective compliance/);
  });

  it('rejects a deferral without a reason', () => {
    expect(
      validatePlan('2026-12-01-brief-ui.md', read('plan-deferred-no-reason.md'), openAt).join('\n'),
    ).toMatch(/RA-013 deferred without a reason/);
  });

  it('rejects a plan whose Date header contradicts its filename', () => {
    const text = '**Date:** 2026-11-01\n\n## Retrospective compliance\n';
    expect(validatePlan('2026-12-01-brief-ui.md', text, openAt).join('\n')).toMatch(
      /Date: 2026-11-01 contradicts filename date 2026-12-01/,
    );
  });

  it('exempts plans dated on or before the adoption date', () => {
    expect(validatePlan('2026-11-22-retrospective-system.md', '# plan\n', openAt)).toEqual([]);
  });

  it('accepts a roadmap whose done rows resolve', () => {
    expect(
      validateRoadmap('ROADMAP.md', read('roadmap-valid.md'), new Set(['2026-11-18/Plan 5'])),
    ).toEqual([]);
  });

  it('rejects a done row with no entry and no exemption', () => {
    const errors = validateRoadmap(
      'ROADMAP.md',
      read('roadmap-missing-retro.md'),
      new Set(['2026-11-18/Plan 5']),
    );
    expect(errors.join('\n')).toMatch(
      /2026-11-19\/Plan 6: no retrospective entry and no "retro: exempt"/,
    );
  });

  it('treats a Status that starts with done as done (R20)', () => {
    const keys = new Set(['2026-10-20/Plan 3', '2026-10-24/Plan 4']);
    const roadmap = [
      '| Plan | Status | Retro |',
      '|---|---|---|',
      '| Plan 3 | done (PR #17) | 2026-10-20/Plan 3 |',
      '| Plan 4 | done (merged, Oct 2026) | 2026-10-24/Plan 4 |',
      '| Future hosting | not planned |  |',
    ].join('\n');
    expect(validateRoadmap('ROADMAP.md', roadmap, keys)).toEqual([]);

    const unresolved = roadmap.replace(
      '| Plan 3 | done (PR #17) | 2026-10-20/Plan 3 |',
      '| Plan 3 | done (PR #17) |  |',
    );
    const errors = validateRoadmap('ROADMAP.md', unresolved, keys).join('\n');
    expect(errors).toMatch(/Plan 3: no retrospective entry and no "retro: exempt"/);
    expect(errors).not.toMatch(/Future hosting/);
  });

  it('enforces the rulings heading grammar', () => {
    expect(validateRulings('rulings.md', read('rulings-valid.md'))).toEqual([]);
    expect(validateRulings('rulings.md', read('rulings-bad.md')).join('\n')).toMatch(
      /heading does not match "## YYYY-MM-DD · Ruling · <task>"/,
    );
  });
});

const archiveText = () => `${read('archive/2026.md')}\n---\n${read('archive/2025.md')}`;

describe('retro-validate: the archive and its global INDEX', () => {
  it('accepts the whole archive against a matching INDEX', () => {
    expect(validateArchivePair('', archiveText(), read('archive/INDEX.md'))).toEqual([]);
  });

  it('rejects an INDEX row that does not match the archived entry', () => {
    const index = read('archive/INDEX.md').replace('Archive entry four.', 'Archive entry for.');
    expect(validateArchivePair('', archiveText(), index).join('\n')).toMatch(
      /INDEX row 2026-11-10 · Plan 4 does not match the archived entry/,
    );
  });

  it('pairs every archive file with the one global INDEX', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const code = main([
      fixture('valid-hot.md'),
      fixture('valid-register.md'),
      fixture('archive/2026.md'),
      fixture('archive/2025.md'),
      fixture('archive/INDEX.md'),
    ]);
    const out = spy.mock.calls.flat().join('\n');
    spy.mockRestore();
    expect(out).toBe('');
    expect(code).toBe(0);
  });

  it('reports a missing INDEX when archives are in scope', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const code = main([
      fixture('valid-hot.md'),
      fixture('valid-register.md'),
      fixture('archive/2026.md'),
    ]);
    const out = spy.mock.calls.flat().join('\n');
    spy.mockRestore();
    expect(code).toBe(1);
    expect(out).toMatch(/no INDEX supplied; rule 6 cannot check the archive/);
  });

  it('rejects a gated plan when no register is supplied', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const code = main([fixture('plans/2026-12-01-brief-ui.md')]);
    const out = spy.mock.calls.flat().join('\n');
    spy.mockRestore();
    expect(code).toBe(1);
    expect(out).toMatch(/no register supplied; the plan gate cannot compute the open set/);
  });

  it('reports a register table without its date column', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    main([fixture('valid-hot.md'), fixture('bad-date-column.md')]);
    const out = spy.mock.calls.flat().join('\n');
    spy.mockRestore();
    expect(out).toMatch(/Closed and dropped actions: no "Date" column/);
  });
});

const PREAMBLE = [
  '# Retrospectives',
  '',
  '> Prime directive: judge the process, not the person.',
  '',
  '**How to use this file:**',
  '',
  '- After every plan completes, append an entry at the TOP (newest first).',
  '',
  '- Rulings for this period: see `docs/superpowers/rulings.md`.',
].join('\n');

const migratedEntry = (heading: string) =>
  [
    heading,
    '',
    '**Headline:** One lesson worth remembering.',
    '**migrated:** true',
    '',
    '### What went well?',
    '',
    '- It worked. → context-only',
    '',
    '### What would we like to continue doing?',
    '',
    '- Keep it. → context-only',
    '',
    '### What would we like to stop doing?',
    '',
    '- Stop it. → context-only',
    '',
    '### Metrics',
    '',
    'metrics: not recorded',
  ].join('\n');

describe('retro-validate: the record preamble and per-entry plan keys', () => {
  it('treats the contract preamble as furniture, not an entry', () => {
    const text = `${PREAMBLE}\n\n---\n\n${migratedEntry('## 2026-11-22 · Plan 7 · retrospective-system')}\n`;
    expect(validateEntries('docs/superpowers/retrospectives.md', text)).toEqual([]);
  });

  it('rejects a heading-less block that follows an entry, naming its line', () => {
    const stray = [
      'Pasted entry without its heading.',
      '',
      '### What went well?',
      '',
      '- It worked. → context-only',
    ].join('\n');
    const text = `${PREAMBLE}\n\n---\n\n${migratedEntry(
      '## 2026-11-22 · Plan 7 · retrospective-system',
    )}\n\n---\n\n${stray}\n`;
    const line = text.split('\n').indexOf('Pasted entry without its heading.') + 1;

    expect(validateEntries('docs/superpowers/retrospectives.md', text)).toEqual([
      `docs/superpowers/retrospectives.md:${line}: entry block has no ## heading`,
    ]);
  });

  it('keeps validating the entries around a heading-less block', () => {
    const stray = ['Another pasted entry.', '', '<summary>', '', 'x', '</summary>'].join('\n');
    const text = [
      PREAMBLE,
      migratedEntry('## 2026-11-22 · Plan 7 · retrospective-system'),
      stray,
      migratedEntry('## 2026-11-22 · Plan 6 · telemetry'),
    ].join('\n\n---\n\n');
    const line = text.split('\n').indexOf('Another pasted entry.') + 1;

    expect(validateEntries('docs/superpowers/retrospectives.md', text)).toEqual([
      `docs/superpowers/retrospectives.md:${line}: entry block has no ## heading`,
    ]);
  });

  it('accepts ad-hoc entries that share a date but not a slug', () => {
    const text = [
      migratedEntry('## 2026-11-20 · Ad-hoc · model-router-cost-rebalance'),
      migratedEntry('## 2026-11-20 · Ad-hoc · branch-worktree-cleanup'),
    ].join('\n---\n');
    expect(validateEntries('docs/superpowers/retrospectives.md', text)).toEqual([]);
  });

  it('still rejects a repeated plan number', () => {
    const text = [
      migratedEntry('## 2026-11-20 · Plan 6 · telemetry'),
      migratedEntry('## 2026-11-18 · Plan 6 · showcase-deployment'),
    ].join('\n---\n');
    expect(validateEntries('docs/superpowers/retrospectives.md', text).join('\n')).toMatch(
      /duplicate plan key "Plan 6"/,
    );
  });
});

describe('retro-validate: closed tables accumulate out of ID order (R22)', () => {
  it('does not compare a row ID to its neighbour', () => {
    const register = [
      '## Closed and dropped actions',
      '| ID | Outcome | Date | Evidence or reason |',
      '|---|---|---|---|',
      '| RA-006 | closed | 2026-11-10 | PR #30 |',
      '| RA-001 | closed | 2026-11-12 | PR #31 |',
      '## Retired practices',
      '| ID | Retired | Reason |',
      '|---|---|---|',
      '| RP-009 | 2026-11-11 | superseded by RP-004 |',
      '| RP-002 | 2026-11-12 | superseded by RP-004 |',
    ].join('\n');

    expect(validateRegister('retro-actions.md', register)).toEqual([]);
  });
});

describe('retro-validate: the hot register row cap (R23)', () => {
  const register = (count: number) =>
    [
      '## Closed and dropped actions',
      '| ID | Outcome | Date | Evidence or reason |',
      '|---|---|---|---|',
      ...Array.from(
        { length: count },
        (_, index) =>
          `| RA-${String(index + 1).padStart(3, '0')} | closed | 2026-11-10 | PR #${index + 1} |`,
      ),
    ].join('\n');

  it('accepts exactly 40 rows', () => {
    expect(validateRegisterCap('docs/superpowers/retro-actions.md', register(40))).toEqual([]);
  });

  it('rejects 41 rows and names retro-rotate', () => {
    expect(validateRegisterCap('docs/superpowers/retro-actions.md', register(41))).toEqual([
      expect.stringContaining('register holds 41 rows; cap is 40'),
    ]);
    expect(
      validateRegisterCap('docs/superpowers/retro-actions.md', register(41)).join('\n'),
    ).toMatch(/run retro-rotate to move closed\/retired rows to register-<year>\.md/);
  });
});

describe('retro-validate: rule 8 cites the register (N3)', () => {
  const plan = (rows: string[]) =>
    [
      '**Date:** 2026-12-01',
      '',
      '## Retrospective compliance',
      '',
      '| ID | Kind | Disposition | Where |',
      '|---|---|---|---|',
      ...rows,
    ].join('\n');

  it('rejects a compliance row whose ID is not in the register', () => {
    const text = plan(['| RA-404 | action | applied | Task 3 |']);

    expect(
      validatePlan('2026-12-01-brief-ui.md', text, () => [], new Set(['RA-001'])).join('\n'),
    ).toMatch(/RA-404: not in the register/);
  });

  it('accepts a compliance row whose ID the register holds', () => {
    const text = plan(['| RA-001 | action | applied | Task 3 |']);

    expect(validatePlan('2026-12-01-brief-ui.md', text, () => [], new Set(['RA-001']))).toEqual([]);
  });

  it('treats a dash-only Where on an applied row as empty', () => {
    const text = plan(['| RA-001 | action | applied | — |']);

    expect(validatePlan('2026-12-01-brief-ui.md', text, () => [], new Set(['RA-001']))).toEqual([
      '2026-12-01-brief-ui.md:1: RA-001: applied without a Where',
    ]);
  });
});

describe('retro-validate: a record with no entries is a violation (N7)', () => {
  it('rejects a file whose headings are all gone', () => {
    const prose = [
      '# Retrospectives',
      '',
      '> Prime directive: judge the process, not the person.',
      '',
      'Prose only: every entry heading was lost in a bad merge.',
    ].join('\n');

    expect(validateEntries('docs/superpowers/retrospectives.md', prose)).toEqual([
      'docs/superpowers/retrospectives.md:1: no entries found',
    ]);
  });
});

describe('retro-validate: the OK line counts entries, not blocks (O6)', () => {
  let cwd: string;
  let dir: string;

  beforeEach(() => {
    cwd = process.cwd();
    dir = mkdtempSync(join(tmpdir(), 'retro-validate-'));
    mkdirSync(join(dir, 'docs', 'superpowers'), { recursive: true });
    process.chdir(dir);
  });

  afterEach(() => {
    process.chdir(cwd);
    rmSync(dir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  it('reports the parsed entry count while the preamble is not an entry', () => {
    const record = join(dir, 'docs', 'superpowers', 'retrospectives.md');
    const register = join(dir, 'docs', 'superpowers', 'retro-actions.md');
    writeFileSync(
      record,
      `${PREAMBLE}\n\n---\n\n${migratedEntry('## 2026-11-22 · Plan 7 · retrospective-system')}\n`,
    );
    writeFileSync(
      register,
      [
        '## Active practices',
        '| ID | Practice | Source | Since | Status |',
        '|---|---|---|---|---|',
        '| RP-009 | Name the cause | Plan 7 | 2026-11-22 | active |',
      ].join('\n'),
    );
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    expect(main([record, register])).toBe(0);
    const out = log.mock.calls.map((call) => String(call[0])).join('\n');
    expect(out).toContain('retro: OK (1 entries, 1 register rows)');
  });
});
