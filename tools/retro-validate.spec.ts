import { readFileSync } from 'fs';
import { resolve } from 'path';
import { main, validateEntries } from './retro-validate';

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
