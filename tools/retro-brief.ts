/**
 * The planning read surface for the retrospective system: a bounded brief that fits on one
 * screen, plus a literal topic search over the hot record and the archive.
 *
 * The brief is deterministic and never throws: an unreadable register or an entry that does
 * not parse degrades to `- none` or to the raw heading and headline rather than failing.
 */

import { readFileSync } from 'fs';

import { isParseError, normalize, parseEntry, parseRegister, splitEntryBlocks } from './retro-lib';

export type TopicHit = { file: string; line: number; heading: string; text: string };

export type BriefInput = {
  today: string;
  hot: string;
  register: string;
  archiveText: string;
  archiveName: string;
};

const RECORD_PATH = 'docs/superpowers/retrospectives.md';
const REGISTER_PATH = 'docs/superpowers/retro-actions.md';
const ARCHIVE_PATH = 'docs/superpowers/retro/archive/2026.md';

const MAX_LINES = 50;
const MAX_ROWS = 12;
const MAX_HITS = 5;

/** §8.5 order: title, active practices, open actions, last retro, archive. At most 50 lines. */
export function buildBrief(input: BriefInput): string {
  const parsed = parseRegister(input.register);
  // R7: `isParseError([])` is true by design; `parseRegister`/`parseEntry` return an array only
  // when errors exist, so the predicate cleanly separates a failed parse from a parsed value.
  const register = isParseError(parsed) ? null : parsed;

  const lines: string[] = [`# Retrospective brief — ${input.today}`, ''];

  section(
    lines,
    '## Active practices (obey)',
    (register?.practices ?? []).map(
      (practice) => `- ${practice.id} ${practice.practice} — since ${practice.since}`,
    ),
  );
  section(
    lines,
    '## Open actions',
    (register?.openActions ?? []).map(
      (action) =>
        `- ${action.id} ${action.action} — owner: ${action.owner}, carried ${action.carried}`,
    ),
  );

  lines.push('## Last retro');
  lines.push(lastRetro(input.hot) ?? '- none');
  lines.push('');

  const count = splitEntryBlocks(input.archiveText).length;
  lines.push('## Archive');
  lines.push(
    `${count} entries in retro/archive/${input.archiveName}. Search: \`npx tsx tools/retro-brief.ts --topic <keywords>\``,
  );

  if (lines.length <= MAX_LINES) return lines.join('\n');
  return [...lines.slice(0, MAX_LINES - 1), '- … (brief truncated)'].join('\n');
}

/**
 * Case-insensitive literal search: every keyword is matched with `String.prototype.includes`,
 * so regex metacharacters are ordinary characters. Returns at most five hits, each carrying the
 * last `## ` heading seen in its file and the bullet text without its `- ` marker.
 */
export function searchTopic(
  keywords: string[],
  files: Array<{ path: string; text: string }>,
): TopicHit[] {
  const needles = keywords
    .map((keyword) => keyword.toLowerCase())
    .filter((keyword) => keyword !== '');
  const hits: TopicHit[] = [];
  if (needles.length === 0) return hits;

  for (const file of files) {
    let heading = '';

    normalize(file.text)
      .split('\n')
      .forEach((raw, index) => {
        const line = raw.trim();
        if (line.startsWith('## ')) heading = line.slice(3).trim();
        if (line === '' || line.startsWith('#') || hits.length >= MAX_HITS) return;
        if (!needles.some((needle) => line.toLowerCase().includes(needle))) return;

        hits.push({
          file: file.path,
          line: index + 1,
          heading,
          text: line.startsWith('- ') ? line.slice(2).trim() : line,
        });
      });

    if (hits.length >= MAX_HITS) break;
  }

  return hits;
}

/**
 * Prints the brief, or the topic hits with `file:line` and the owning heading. Missing files are
 * treated as empty so a repository that has not adopted the records yet still gets a brief.
 */
export function main(argv: string[] = process.argv.slice(2)): number {
  const topicAt = argv.indexOf('--topic');

  if (topicAt !== -1) {
    const keywords = (argv[topicAt + 1] ?? '')
      .split(',')
      .map((keyword) => keyword.trim())
      .filter((keyword) => keyword !== '');
    if (keywords.length === 0) {
      console.error('retro-brief: --topic needs a comma-separated keyword list');
      return 1;
    }

    const hits = searchTopic(keywords, [
      { path: RECORD_PATH, text: readOptional(RECORD_PATH) },
      { path: ARCHIVE_PATH, text: readOptional(ARCHIVE_PATH) },
    ]);

    for (const hit of hits) {
      console.log(`${hit.file}:${hit.line} · ${hit.heading}`);
      console.log(`  ${hit.text}`);
    }
    if (hits.length === 0) console.log(`retro-brief: no topic hits for ${keywords.join(', ')}`);
    return 0;
  }

  console.log(
    buildBrief({
      today: localToday(),
      hot: readOptional(RECORD_PATH),
      register: readOptional(REGISTER_PATH),
      archiveText: readOptional(ARCHIVE_PATH),
      archiveName: ARCHIVE_PATH.slice(ARCHIVE_PATH.lastIndexOf('/') + 1),
    }),
  );
  return 0;
}

function section(lines: string[], title: string, rows: string[]): void {
  lines.push(title);
  if (rows.length === 0) {
    lines.push('- none');
    lines.push('');
    return;
  }
  const shown = rows.slice(0, MAX_ROWS);
  lines.push(...shown);
  if (rows.length > shown.length) lines.push(`- … ${rows.length - shown.length} more`);
  lines.push('');
}

/** The newest entry is the first block of the newest-first hot record. */
function lastRetro(hot: string): string | null {
  for (const block of splitEntryBlocks(hot)) {
    const entry = parseEntry(block.text);
    // Same R7 predicate: only an error array takes the raw-heading fallback.
    if (!isParseError(entry)) return `${entry.planKey} — ${entry.headline}`;

    const lines = block.text.split('\n').map((line) => line.trim());
    const heading = lines.find((line) => line.startsWith('## '));
    const headline = lines.find((line) => /^\*\*headline:\*\*/i.test(line));
    if (heading === undefined || headline === undefined) continue;

    const key = heading.slice(3).trim();
    const value = headline.replace(/^\*\*headline:\*\*/i, '').trim();
    if (key !== '' && value !== '') return `${key} — ${value}`;
  }
  return null;
}

function readOptional(path: string): string {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
}

/** The human's calendar day; `toISOString()` would name yesterday west of UTC (and last month at a month boundary). */
function localToday(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

if (require.main === module) {
  // `exitCode`, not `exit()`: a piped stdout (`| Measure-Object -Line`) must flush before exit.
  process.exitCode = main(process.argv.slice(2));
}
