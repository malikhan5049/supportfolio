/**
 * The planning read surface for the retrospective system: a bounded brief that fits on one
 * screen, plus a literal topic search over the hot record and the archive.
 *
 * The brief is deterministic and never throws: an unreadable register or an entry that does
 * not parse degrades to `- none` or to the raw heading and headline rather than failing.
 */

import { readdirSync, readFileSync } from 'fs';

import { isParseError, normalize, parseEntry, parseRegister, splitEntryBlocks } from './retro-lib';

export type TopicHit = { file: string; line: number; heading: string; text: string };

export type BriefInput = {
  today: string;
  hot: string;
  register: string;
  /** One archive file's text, for callers that hold a single year. */
  archiveText: string;
  /** The name that text came from, printed in the Archive line. */
  archiveName: string;
  /** Every year file, so the brief counts the whole archive and never rots at rollover (N5). */
  archives?: Array<{ name: string; text: string }>;
};

const RECORD_PATH = 'docs/superpowers/retrospectives.md';
const REGISTER_PATH = 'docs/superpowers/retro-actions.md';
const ARCHIVE_DIR = 'docs/superpowers/retro/archive';
// Mirrors `YEAR_FILE_RE` in `tools/retro-rotate.ts`: only `archive/<year>.md` holds entries.
// `register-<year>.md` is a register (its section headings are not entry blocks) and INDEX is an index.
const YEAR_FILE_RE = /^(\d{4})\.md$/;

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

  const archives = archiveInputs(input);
  const count = archives.reduce((total, file) => total + entryCount(file.text), 0);
  lines.push('## Archive');
  const where =
    archives.length === 0
      ? 'retro/archive/ (no year files yet)'
      : `retro/archive/${archives.map((file) => file.name).join(', ')}`;
  lines.push(
    `${count} entries in ${where}. Search: \`npx tsx tools/retro-brief.ts --topic <keywords>\``,
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
      ...readArchives().map((file) => ({ path: `${ARCHIVE_DIR}/${file.name}`, text: file.text })),
    ]);

    for (const hit of hits) {
      console.log(`${hit.file}:${hit.line} · ${hit.heading}`);
      console.log(`  ${hit.text}`);
    }
    if (hits.length === 0) console.log(`retro-brief: no topic hits for ${keywords.join(', ')}`);
    return 0;
  }

  const archives = readArchives();
  console.log(
    buildBrief({
      today: localToday(),
      hot: readOptional(RECORD_PATH),
      register: readOptional(REGISTER_PATH),
      archiveText: '',
      archiveName: '',
      archives,
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

/** The year files the brief reports on: `archives` when given, else the single `archiveText`. */
function archiveInputs(input: BriefInput): Array<{ name: string; text: string }> {
  if (input.archives !== undefined) return input.archives;
  if (input.archiveText === '') return [];
  return [{ name: input.archiveName, text: input.archiveText }];
}

/** Blocks that carry a heading; an archive file's preamble is never counted as an entry. */
function entryCount(text: string): number {
  return splitEntryBlocks(text).filter((block) =>
    block.text.split('\n').some((line) => line.trim().startsWith('## ')),
  ).length;
}

/** Every `archive/<year>.md`; `register-<year>.md` and `INDEX.md` are not archives of entries. */
function readArchives(): Array<{ name: string; text: string }> {
  let names: string[];
  try {
    names = readdirSync(ARCHIVE_DIR);
  } catch {
    return [];
  }

  return names
    .filter((name) => YEAR_FILE_RE.test(name))
    .sort()
    .map((name) => ({ name, text: readOptional(`${ARCHIVE_DIR}/${name}`) }));
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
