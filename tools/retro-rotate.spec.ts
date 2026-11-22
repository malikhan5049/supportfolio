import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';

import { rotate } from './retro-rotate';
import { main as validateMain, validateRegister } from './retro-validate';

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
]
  .map(([p, d]) => block(d, p))
  .join('\n---\n');
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
    expect(
      JSON.stringify(
        rotate({ hot: bad, archive: '', index: '', year: '2026', today: '2026-11-22' }),
      ),
    ).toMatch(/Plan 4: bullet has no disposition tag/);
  });

  it('is a no-op when three entries are hot', () => {
    const r = rotate({ hot: three, archive: '', index: '', year: '2026', today: '2026-11-22' });
    if (Array.isArray(r)) throw new Error(JSON.stringify(r));
    expect([r.rotated, r.hot, r.index]).toEqual([null, three, '']);
  });

  it('names the entry that owns an undisposed bullet', () => {
    const bad = four.replace('- Skipping builds → RA-013', '- Skipping builds');
    const errors = rotate({ hot: bad, archive: '', index: '', year: '2026', today: '2026-11-22' });
    if (!Array.isArray(errors)) throw new Error('expected the rotation to be refused');
    const message = errors.map((error) => error.message).join('\n');
    expect(message).toContain('Plan 4: bullet has no disposition tag');
    expect(message).toContain('in Plan 7');
  });

  it('does not prepend an INDEX row it already holds for an ad-hoc entry', () => {
    const hot = [
      block('2026-11-22', 'Plan 7'),
      block('2026-11-20', 'Plan 6'),
      block('2026-11-18', 'Plan 5'),
      block('2026-11-10', 'Ad-hoc'),
    ].join('\n---\n');
    const row = '2026-11-10 · Ad-hoc/demo-slug · Lesson for Ad-hoc. · RA-013, RP-004';

    const r = rotate({ hot, archive: '', index: row, year: '2026', today: '2026-11-22' });
    if (Array.isArray(r)) throw new Error(JSON.stringify(r));

    expect(r.rotated?.planKey).toBe('Ad-hoc');
    expect(r.index.trim()).toBe(row);
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
    const r = rotate({
      hot: four,
      archive: '',
      index: '',
      year: '2026',
      today: '2026-11-22',
      register: reg,
    });
    if (Array.isArray(r)) throw new Error(JSON.stringify(r));
    expect(r.retiredRegister.join('\n')).toMatch(/RA-012/);
    expect(r.retiredRegister.join('\n')).not.toMatch(/RP-002/);
  });
});

describe('rotate: the year register file stays a register (N1)', () => {
  let cwd: string;
  let dir: string;

  const put = (path: string, text: string): void => {
    const full = join(dir, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, text);
  };

  beforeEach(() => {
    cwd = process.cwd();
    dir = mkdtempSync(join(tmpdir(), 'retro-rotate-'));
    process.chdir(dir);
  });

  afterEach(() => {
    process.chdir(cwd);
    rmSync(dir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  it('writes a self-describing year file whose rows still resolve citations', () => {
    const register = [
      '## Closed and dropped actions',
      '| ID | Outcome | Date | Evidence or reason |',
      '|---|---|---|---|',
      '| RA-012 | closed | 2025-12-01 | PR #20 |',
    ].join('\n');

    const r = rotate({
      hot: four,
      archive: '',
      index: '',
      year: '2026',
      today: '2026-11-22',
      register,
    });
    if (Array.isArray(r)) throw new Error(JSON.stringify(r));

    const yearFile = r.registerArchive ?? '';
    expect(yearFile).toContain('## Closed and dropped actions');
    expect(yearFile).toContain('| ID | Outcome | Date | Evidence or reason |');
    expect(yearFile).toContain('| RA-012 |');
    expect(validateRegister('register-2026.md', yearFile)).toEqual([]);

    // A record citing the retired ID still passes rule 4 against the hot register plus its year file.
    const hotEntry = block('2026-11-22', 'Plan 7')
      .replace('**Headline:**', '**migrated:** true\n**Headline:**')
      .replace('RA-013', 'RA-012')
      .split('RP-004')
      .join('RA-012');
    put('docs/superpowers/retrospectives.md', hotEntry);
    put('docs/superpowers/retro-actions.md', r.registerKept ?? '');
    put('docs/superpowers/retro/archive/register-2026.md', yearFile);

    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const code = validateMain([
      join(dir, 'docs/superpowers/retrospectives.md'),
      join(dir, 'docs/superpowers/retro-actions.md'),
      join(dir, 'docs/superpowers/retro/archive/register-2026.md'),
    ]);
    const out = spy.mock.calls.flat().join('\n');
    spy.mockRestore();

    expect(out).toBe('');
    expect(code).toBe(0);
  });
});

describe('rotate: the entry files by its own year (N5) and reports real lines (N8)', () => {
  it('lands an entry dated 2025 in 2025.md during a 2026 run', () => {
    const existing2026 = block('2026-01-05', 'Plan 3');
    const hot = [
      block('2026-11-22', 'Plan 7'),
      block('2026-11-20', 'Plan 6'),
      block('2026-11-18', 'Plan 5'),
      block('2025-12-30', 'Plan 4'),
    ].join('\n---\n');

    const r = rotate({
      hot,
      archive: '',
      index: '',
      year: '2026',
      today: '2026-11-22',
      archives: [{ year: '2026', text: existing2026 }],
    });
    if (Array.isArray(r)) throw new Error(JSON.stringify(r));

    const landed = r.archives.find((file) => file.year === '2025');
    expect(landed?.text).toContain('## 2025-12-30 · Plan 4');
    expect(r.archive).toBe(landed?.text);
    expect(r.archives.find((file) => file.year === '2026')?.text).toBe(existing2026);
  });

  it('reports the refusal in document coordinates', () => {
    const blocks = four.split('\n---\n');
    blocks[3] = blocks[3].replace('- Skipping builds → RA-013', '- Skipping builds');
    const bad = blocks.join('\n---\n');

    const errors = rotate({ hot: bad, archive: '', index: '', year: '2026', today: '2026-11-22' });
    if (!Array.isArray(errors)) throw new Error('expected the rotation to be refused');

    const base = bad.split('\n').findIndex((line) => line.startsWith('## 2026-11-10')) + 1;
    const expected = base + 7;
    const undisposed = errors.find((error) => /bullet has no disposition tag/.test(error.message));

    expect(undisposed?.line).toBe(expected);
    expect(undisposed?.message).toContain(`(line ${expected})`);
    expect(undisposed?.message).toMatch(/^Plan 4: bullet has no disposition tag/);
  });
});
