/**
 * Gated rotation for the retrospective system: the oldest hot entry moves into the yearly archive,
 * its INDEX row is prepended, and closed/retired register rows dated before the current year move
 * into `retro/archive/register-<year>.md`.
 *
 * Rotation is all-or-nothing. A hot record that does not parse, or a bullet still waiting for a
 * disposition tag, leaves every file untouched: the caller gets the errors instead of a result.
 */

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';

import {
  formatIndexRow,
  indexPlanKey,
  isParseError,
  normalize,
  parseEntry,
  splitEntryBlocks,
} from './retro-lib';
import type { Entry, ParseError } from './retro-lib';

/** One archived entry file, named by the year it holds. */
export type YearFile = { year: string; text: string };

export type RotateInput = {
  hot: string;
  archive: string;
  index: string;
  year: string;
  today: string;
  register?: string;
  /** Every year file present, so an entry lands in the file its own date names (N5). */
  archives?: YearFile[];
  /** The current year's `register-<year>.md`, so a second run appends instead of replacing. */
  registerArchive?: string;
};

export type RotateResult = {
  hot: string;
  /** The year file the rotated entry landed in (unchanged when nothing rotated). */
  archive: string;
  /** Every year file after the rotation; untouched files come back verbatim. */
  archives: YearFile[];
  index: string;
  rotated: Entry | null;
  /** The retired register rows, one line each. */
  retiredRegister: string[];
  /** The hot register with those rows removed, or `null` when no register was supplied. */
  registerKept: string | null;
  /** The merged `register-<year>.md` text, or `null` when no row moved. */
  registerArchive: string | null;
};

const RECORD_PATH = 'docs/superpowers/retrospectives.md';
const REGISTER_PATH = 'docs/superpowers/retro-actions.md';
const ARCHIVE_DIR = 'docs/superpowers/retro/archive';
const INDEX_PATH = `${ARCHIVE_DIR}/INDEX.md`;

const HOT_LIMIT = 3;
const SEPARATOR = '\n\n---\n\n';
const MAX_REPORTED_ERRORS = 10;

/** Register section → the column holding the date that decides whether the row is retired. */
const REGISTER_DATE_COLUMNS: Record<string, string> = {
  'Closed and dropped actions': 'date',
  'Retired practices': 'retired',
};

const UNDISPOSED_RE = /bullet has no disposition tag/;
const LINE_PREFIX_RE = /^line \d+: /;
const ROW_SEPARATOR_RE = /^:?-{3,}:?$/;
const YEAR_FILE_RE = /^(\d{4})\.md$/;

/** One section's worth of retired rows, carrying the heading and header a year file needs. */
type RegisterMove = { section: string; header: string; separator: string; rows: string[] };

/**
 * Why `entry` may not leave the hot record, or `null` when it may. `parseEntry` already rejects a
 * bullet without a disposition tag, so a parsed entry normally passes; the guard keeps the
 * "every bullet is disposed" rule in one place and catches an entry assembled by hand.
 */
export function refuseReason(entry: Entry): string | null {
  for (const section of entry.sections) {
    for (const bullet of section.bullets) {
      if (bullet.disposition.id === undefined && !bullet.disposition.contextOnly) {
        return 'bullet has no disposition tag';
      }
    }
  }
  return null;
}

/**
 * Rotates the oldest hot entry and the previous year's register rows. The hot record is
 * newest-first, so the oldest entry is the last block. Returns parse errors — with the refusal
 * filed against the entry whose rotation is blocked — instead of touching anything.
 *
 * The archived entry goes into the year file its own date names (N5), not into a hard-coded
 * current year: a record rotated late in January must not file December's entry under January.
 */
export function rotate(input: RotateInput): RotateResult | ParseError[] {
  const register = input.register === undefined ? null : splitRegister(input.register, input.year);
  const retiredRegister = register === null ? [] : register.moves.flatMap((move) => move.rows);
  const registerKept = register === null ? null : register.kept;
  const registerArchive =
    register === null || register.moves.length === 0
      ? null
      : mergeRegisterYear(input.registerArchive ?? '', register.moves);

  const archives = new Map<string, string>();
  for (const file of input.archives ?? []) archives.set(file.year, file.text);
  if (input.archives === undefined) archives.set(input.year, input.archive);

  const blocks = splitEntryBlocks(input.hot);
  const entryBlocks = blocks.filter((block) => isEntryBlock(block.text));
  if (entryBlocks.length <= HOT_LIMIT) {
    return {
      hot: input.hot,
      archive: archives.get(input.year) ?? '',
      archives: archiveList(archives),
      index: input.index,
      rotated: null,
      retiredRegister,
      registerKept,
      registerArchive,
    };
  }

  const parsedBlocks = entryBlocks.map((block) => ({ block, parsed: parseEntry(block.text) }));
  const candidateBlock = entryBlocks[entryBlocks.length - 1];
  const candidateKey = planKeyOf(candidateBlock.text);

  // Every blocking error keeps the entry that owns it, so a refusal can say where to look, and the
  // block's start line, so the reported line is a document line (the validator reports the same way).
  const blocking = parsedBlocks.flatMap(({ block, parsed }) =>
    isParseError(parsed)
      ? parsed.map((error) => ({ error, owner: planKeyOf(block.text), base: block.startLine }))
      : [],
  );
  if (blocking.length > 0) return refuse(blocking, candidateKey);

  const entries = parsedBlocks
    .map((value) => value.parsed)
    .filter((value): value is Entry => !isParseError(value));
  const rotated = entries[entries.length - 1];

  const reason = refuseReason(rotated);
  if (reason !== null) {
    return [{ line: candidateBlock.startLine, message: `${candidateKey}: ${reason}` }];
  }

  const hot = blocks
    .filter((block) => block !== candidateBlock)
    .map((block) => block.text)
    .join(SEPARATOR);

  // N5: the entry's own year decides the file; a missing year file is created.
  const targetYear = rotated.date.slice(0, 4);
  const archived = normalize(archives.get(targetYear) ?? '').trim();
  const archive =
    archived === '' ? candidateBlock.text : `${candidateBlock.text}${SEPARATOR}${archived}`;
  archives.set(targetYear, archive);

  const current = normalize(input.index).trim();
  const row = formatIndexRow(rotated);
  const present = current
    .split('\n')
    .some((line) => line.trim().startsWith(`${rotated.date} · ${indexPlanKey(rotated)} ·`));
  const index = present ? current : current === '' ? row : `${row}\n${current}`;

  return {
    hot,
    archive,
    archives: archiveList(archives),
    index,
    rotated,
    retiredRegister,
    registerKept,
    registerArchive,
  };
}

/**
 * Reads the hot record, its yearly archives, the INDEX and the register, then rotates. Exit 1 when
 * the record refuses to rotate (parse error or undisposed bullet), else 0.
 */
export function main(argv: string[] = process.argv.slice(2)): number {
  if (argv.length > 0) {
    console.error(`retro-rotate: unknown argument "${argv[0]}" — rotation takes no options`);
    return 1;
  }

  const today = localToday();
  const year = today.slice(0, 4);
  const registerArchivePath = `${ARCHIVE_DIR}/register-${year}.md`;

  const hot = readOptional(RECORD_PATH);
  if (hot.trim() === '') {
    console.error(`retro-rotate: ${RECORD_PATH} has no entries`);
    return 1;
  }

  const register = readOptional(REGISTER_PATH);
  const result = rotate({
    hot,
    archive: readOptional(`${ARCHIVE_DIR}/${year}.md`),
    index: readOptional(INDEX_PATH),
    year,
    today,
    register,
    archives: readArchives(),
    registerArchive: readOptional(registerArchivePath),
  });

  if (isParseError(result)) {
    for (const item of result.slice(0, MAX_REPORTED_ERRORS)) {
      console.error(`retro-rotate: ${item.message}`);
    }
    if (result.length > MAX_REPORTED_ERRORS) {
      console.error(`retro-rotate: … ${result.length - MAX_REPORTED_ERRORS} more`);
    }
    return 1;
  }

  if (result.registerArchive !== null && result.registerKept !== null) {
    write(REGISTER_PATH, result.registerKept);
    write(registerArchivePath, result.registerArchive);
    console.log(`retired ${result.retiredRegister.length} register rows → ${registerArchivePath}`);
  }

  if (result.rotated === null) {
    const held = splitEntryBlocks(result.hot).filter((block) => isEntryBlock(block.text)).length;
    console.log(`retro-rotate: ${RECORD_PATH} still holds ${held} entries — nothing to rotate`);
    return 0;
  }

  // Every year file the rotation touched; untouched ones are rewritten identically, empty ones skipped.
  for (const file of result.archives) {
    if (file.text.trim() === '') continue;
    write(`${ARCHIVE_DIR}/${file.year}.md`, file.text);
  }
  write(RECORD_PATH, result.hot);
  write(INDEX_PATH, result.index);
  console.log(
    `rotated ${result.rotated.date} · ${result.rotated.planKey} → ${ARCHIVE_DIR}/${result.rotated.date.slice(0, 4)}.md`,
  );
  return 0;
}

/**
 * Splits the register's closed and retired tables: rows dated before `<year>-01-01` move out —
 * each section keeping its heading, header row and separator so the year file describes itself —
 * and everything else is kept verbatim.
 */
function splitRegister(text: string, year: string): { kept: string; moves: RegisterMove[] } {
  const cutoff = `${year}-01-01`;
  const kept: string[] = [];
  const moves = new Map<string, RegisterMove>();

  let section: string | null = null;
  let dateColumn = -1;
  let headerRow = '';
  let separatorRow = '';

  for (const raw of normalize(text).split('\n')) {
    const line = raw.trim();

    if (line.startsWith('## ')) {
      section = line.slice(3).trim();
      dateColumn = -1;
      headerRow = '';
      separatorRow = '';
      kept.push(raw);
      continue;
    }

    const columnName = section === null ? undefined : REGISTER_DATE_COLUMNS[section];
    if (columnName === undefined || section === null || !line.startsWith('|')) {
      kept.push(raw);
      continue;
    }

    const cells = rowCells(line);
    if (headerRow === '') {
      dateColumn = cells.map((cell) => cell.toLowerCase()).indexOf(columnName);
      headerRow = line;
      kept.push(raw);
      continue;
    }
    if (cells.length > 0 && cells.every((cell) => ROW_SEPARATOR_RE.test(cell))) {
      separatorRow = line;
      kept.push(raw);
      continue;
    }

    const date = cells[dateColumn] ?? '';
    if (date !== '' && date < cutoff) {
      let move = moves.get(section);
      if (move === undefined) {
        move = { section, header: headerRow, separator: separatorRow, rows: [] };
        moves.set(section, move);
      }
      move.rows.push(line);
      continue;
    }
    kept.push(raw);
  }

  return { kept: kept.join('\n'), moves: Array.from(moves.values()) };
}

/**
 * Appends this run's retired rows to the year file, one table per section. The heading, header
 * row and separator travel with the rows, so `register-<year>.md` is a register the validator can
 * read on its own (retro-validate classifies it by name and still resolves every cited ID).
 */
function mergeRegisterYear(existing: string, moves: RegisterMove[]): string {
  const normalized = normalize(existing).trim();
  const lines = normalized === '' ? [] : normalized.replace(/\n+$/, '').split('\n');

  for (const move of moves) {
    const heading = `## ${move.section}`;
    const headingAt = lines.findIndex((line) => line.trim() === heading);

    if (headingAt === -1) {
      if (lines.length > 0) lines.push('');
      lines.push(heading, move.header, move.separator, ...move.rows);
      continue;
    }

    let sectionEnd = lines.length;
    for (let index = headingAt + 1; index < lines.length; index += 1) {
      if (lines[index].trim().startsWith('## ')) {
        sectionEnd = index;
        break;
      }
    }

    let insertAt = sectionEnd;
    while (insertAt > headingAt + 1 && lines[insertAt - 1].trim() === '') insertAt -= 1;
    lines.splice(insertAt, 0, ...move.rows);
  }

  return lines.join('\n');
}

/**
 * A blocking parse error is reported as `<planKey>: <reason> — line N, in <owner>`: the plan key of
 * the entry whose rotation is blocked comes first (R13: the refusal names the blocked rotation),
 * and the entry that owns the offending line follows, so an operator never inspects a clean entry.
 * The mandated prefix stays byte-identical; the owning entry is appended. `N` is a document line
 * (O5/N8): `parseEntry` reports block-relative lines, and the validator's readers think in file
 * coordinates.
 */
function refuse(
  blocking: Array<{ error: ParseError; owner: string; base: number }>,
  planKey: string,
): ParseError[] {
  return blocking.map(({ error, owner, base }) => {
    const line = error.line + base - 1;
    const message = UNDISPOSED_RE.test(error.message)
      ? `${planKey}: ${error.message.replace(LINE_PREFIX_RE, '')} (line ${line}${
          owner === planKey ? '' : `, in ${owner}`
        })`
      : error.message.replace(LINE_PREFIX_RE, `line ${line}: `);
    return { line, message };
  });
}

/** `<planKey>` from a block heading, tolerant of headings the entry parser rejects. */
function planKeyOf(text: string): string {
  const heading = text.split('\n').find((line) => line.trim().startsWith('## '));
  if (heading === undefined) return 'entry';

  const tagged = /(Plan \d+|Ad-hoc)/.exec(heading);
  if (tagged !== null) return tagged[1];

  const tail = heading.trim().slice(3).split('·')[1]?.trim();
  return tail === undefined || tail === '' ? 'entry' : tail;
}

/** True when the block carries an entry heading; the record's preamble is furniture, not an entry. */
function isEntryBlock(text: string): boolean {
  return text.split('\n').some((line) => line.trim().startsWith('## '));
}

function rowCells(line: string): string[] {
  const cells = line.split('|').map((cell) => cell.trim());
  if (cells.length > 0 && cells[0] === '') cells.shift();
  if (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();
  return cells;
}

function archiveList(archives: Map<string, string>): YearFile[] {
  return Array.from(archives, ([year, text]) => ({ year, text })).sort((a, b) =>
    a.year < b.year ? -1 : a.year > b.year ? 1 : 0,
  );
}

/** Every `archive/<year>.md` on disk; `INDEX.md` is not an entry file. */
function readArchives(): YearFile[] {
  let names: string[];
  try {
    names = readdirSync(ARCHIVE_DIR);
  } catch {
    return [];
  }

  const files: YearFile[] = [];
  for (const name of names.sort()) {
    const match = YEAR_FILE_RE.exec(name);
    if (match === null) continue;
    files.push({ year: match[1], text: readOptional(`${ARCHIVE_DIR}/${name}`) });
  }
  return files;
}

function readOptional(path: string): string {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
}

/** `\n` line endings, exactly one trailing newline. */
function write(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${normalize(text).replace(/\n+$/, '')}\n`, 'utf8');
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
