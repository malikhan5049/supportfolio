import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  main,
  validateEntries,
  validatePlan,
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

  it('enforces the rulings heading grammar', () => {
    expect(validateRulings('rulings.md', read('rulings-valid.md'))).toEqual([]);
    expect(validateRulings('rulings.md', read('rulings-bad.md')).join('\n')).toMatch(
      /heading does not match "## YYYY-MM-DD · Ruling · <task>"/,
    );
  });
});
