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

const errs = (v: unknown) => JSON.stringify(v).replace(/\\"/g, '"');

describe('parseEntry', () => {
  it('parses CRLF and LF input identically', () => {
    expect(parseEntry(entry.replace(/\n/g, '\r\n'))).toEqual(parseEntry(entry));
    expect(normalize('a\r\nb\rc')).toBe('a\nb\nc');
  });

  it('parses a valid entry', () => {
    const e = parseEntry(entry);
    if (!('headline' in e)) throw new Error(errs(e));
    expect([e.date, e.planKey, e.slug, e.prNumber]).toEqual([
      '2026-11-22',
      'Plan 7',
      'retrospective-system',
      52,
    ]);
    expect(e.reviewed).toEqual([
      { id: 'RA-012', status: 'closed', note: 'evidence: PR #52' },
      { id: 'RP-003', status: 'kept' },
    ]);
    expect(e.sections.map((s) => s.title)).toEqual([
      'Previous actions reviewed',
      'What went well?',
      'What would we like to continue doing?',
      'What would we like to stop doing?',
      'Metrics',
    ]);
    expect(e.sections[1].bullets[1].disposition).toEqual({ contextOnly: true });
    expect([e.metrics, e.migrated]).toEqual([
      'tasks 10 · retries 1 · escaped defects 0 · review 0C/0I/0m',
      false,
    ]);
  });

  it('rejects an entry without a headline', () => {
    const e = parseEntry(entry.replace('**Headline:** A bounded brief beats a growing log.\n', ''));
    expect(errs(e)).toMatch(/line 1: missing Headline:/);
  });

  it('rejects a missing required section, naming it', () => {
    const e = parseEntry(
      entry.replace('### What would we like to stop doing?', '### What to stop'),
    );
    expect(errs(e)).toMatch(/required section "What would we like to stop doing\?"/);
  });

  it('rejects a bullet without a disposition tag', () => {
    const e = parseEntry(entry.replace('- Recon paid off → context-only', '- Recon paid off'));
    expect(errs(e)).toMatch(
      /line 8: bullet has no disposition tag \(→ RP-nnn, → RA-nnn, or → context-only\)/,
    );
    expect(errs(e)).toMatch(/Recon paid off/);
  });

  it('rejects a bullet with two disposition tags', () => {
    expect(errs(parseEntry(entry.replace('→ context-only', '→ RP-004 → RA-013')))).toMatch(
      /2 disposition tags, expected exactly 1/,
    );
  });

  it('rejects a malformed disposition tag', () => {
    expect(errs(parseEntry(entry.replace('→ RA-013', '→ RA-13')))).toMatch(
      /malformed disposition tag/,
    );
  });
});

describe('parseRegister', () => {
  it('parses a valid register', () => {
    const r = parseRegister(register);
    if (!('openActions' in r)) throw new Error(errs(r));
    expect(r.openActions[0]).toEqual({
      id: 'RA-013',
      action: 'Add nx build to the UI checklist',
      owner: 'controller',
      opened: '2026-11-22',
      doneWhen: 'checklist committed',
      carried: 0,
      status: 'open',
    });
    expect(r.practices[0].id).toBe('RP-004');
    expect(r.closedActions[0]).toEqual({
      id: 'RA-012',
      outcome: 'closed',
      date: '2026-11-22',
      evidence: 'PR #52',
    });
    expect(r.retiredPractices[0].id).toBe('RP-002');
  });

  it('rejects an unknown status naming the row ID', () => {
    expect(errs(parseRegister(register.replace('| 0 | open |', '| 0 | wip |')))).toMatch(
      /RA-013: unknown status "wip"/,
    );
  });

  it('rejects a row missing owner or done-when', () => {
    expect(errs(parseRegister(register.replace('| controller |', '|  |')))).toMatch(
      /RA-013: missing owner/,
    );
    expect(errs(parseRegister(register.replace('| checklist committed |', '|  |')))).toMatch(
      /RA-013: missing done-when/,
    );
  });
});

describe('parseIndex and planDateFromFile', () => {
  it('parses index rows with and without a PR number', () => {
    const rows = parseIndex(
      [
        '2026-11-22 · Plan 7 · PR #52 · A bounded brief wins · RA-013, RP-004',
        '2026-11-18 · Plan 5 · Restore the orphan heading · -',
      ].join('\n'),
    );
    expect(rows[0]).toEqual({
      date: '2026-11-22',
      planKey: 'Plan 7',
      prNumber: 52,
      headline: 'A bounded brief wins',
      ids: ['RA-013', 'RP-004'],
      line: 1,
    });
    expect([rows[1].prNumber, rows[1].ids]).toEqual([null, []]);
  });

  it('prefers the filename date prefix', () => {
    expect(planDateFromFile('docs/superpowers/plans/2026-12-01-retro-ui.md')).toBe('2026-12-01');
    expect(planDateFromFile('docs/superpowers/plans/notes.md')).toBeNull();
  });
});
