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
