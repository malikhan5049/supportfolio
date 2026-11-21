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
    const brief = buildBrief({
      today: '2026-11-22',
      hot,
      register,
      archiveText: '',
      archiveName: '2026.md',
    });
    expect(brief.split('\n').length).toBeLessThanOrEqual(50);
    expect(brief).toContain('RP-004 Recon before design — since 2026-11-20');
    expect(brief).toContain(
      'RA-013 Add nx build to the UI checklist — owner: controller, carried 1',
    );
    expect(brief).toContain('Plan 7 — A bounded brief beats a growing log.');
    expect(brief).toContain('npx tsx tools/retro-brief.ts --topic');
  });
});

describe('searchTopic', () => {
  const files = [
    {
      path: 'retrospectives.md',
      text: '## 2026-11-22 · Plan 7 · retrospective-system · PR #52\n\n- Learned c++ templates → context-only\n',
    },
  ];

  it('finds a literal substring with file, line, and owning heading', () => {
    expect(searchTopic(['c++'], files)).toEqual([
      {
        file: 'retrospectives.md',
        line: 3,
        heading: '2026-11-22 · Plan 7 · retrospective-system · PR #52',
        text: 'Learned c++ templates → context-only',
      },
    ]);
  });

  it('treats regex metacharacters as literal text', () => {
    expect(searchTopic(['c.*'], files)).toEqual([]);
    expect(searchTopic(['('], files)).toEqual([]);
    expect(() => searchTopic(['a)b', '[', '\\'], files)).not.toThrow();
  });

  it('caps results at five', () => {
    const many = {
      path: 'x.md',
      text: Array.from({ length: 9 }, () => '- needle → context-only').join('\n'),
    };
    expect(searchTopic(['needle'], [many])).toHaveLength(5);
  });
});
