import { isParseError, parseEntry } from './retro-lib';

/** A complete entry, so only the marker (or the bullet) under test can raise a finding. */
const entry = (marker: string, bullet = '- Kept the spec first → RP-004') =>
  [
    '## 2026-11-18 · Plan 5 · showcase-deployment',
    '**Headline:** One lesson.',
    marker,
    '### What went well?',
    bullet,
    '### What would we like to continue doing?',
    '- Keep it → context-only',
    '### What would we like to stop doing?',
    '- Stop it → context-only',
    '### Metrics',
    'metrics: not recorded',
  ].join('\n');

describe('parseEntry: the migrated marker carries its reconstruction note (N11)', () => {
  it('parses a suffixed marker and keeps migrated true', () => {
    const parsed = parseEntry(
      entry('**migrated:** true — heading reconstructed 2026-11-22 (source block had no heading)'),
    );
    if (isParseError(parsed)) throw new Error(JSON.stringify(parsed));

    expect([parsed.migrated, parsed.migratedNote]).toEqual([
      true,
      'heading reconstructed 2026-11-22 (source block had no heading)',
    ]);
  });

  it('accepts the bare marker with no note', () => {
    const parsed = parseEntry(entry('**migrated:** true'));
    if (isParseError(parsed)) throw new Error(JSON.stringify(parsed));

    expect([parsed.migrated, parsed.migratedNote]).toEqual([true, undefined]);
  });
});

describe('parseEntry: the two-tag message names the usual cause (N13)', () => {
  it('tells the writer that a stray arrow in prose is the cause', () => {
    const parsed = parseEntry(entry('**migrated:** true', '- Step 1 → Step 2 → RP-004'));
    if (!isParseError(parsed)) throw new Error('expected a parse error');

    expect(parsed.map((error) => error.message).join('\n')).toMatch(
      /2 disposition tags, expected exactly 1 \(remove stray → characters from prose\)/,
    );
  });
});
