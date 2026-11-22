/**
 * Gated rotation for the retrospective system: the oldest hot entry moves into the yearly archive,
 * its INDEX row is prepended, and closed/retired register rows dated before the current year move
 * into `retro/archive/register-<year>.md`.
 *
 * Rotation is all-or-nothing. A hot record that does not parse, or a bullet still waiting for a
 * disposition tag, leaves every file untouched: the caller gets the errors instead of a result.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'fs';
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

export type RotateInput = {
  hot: string;
  archive: string;
  index: string;
  year: string;
  today: string;
  register?: string;
};

export type RotateResult = {
  hot: string;
  archive: string;
  index: string;
  rotated: Entry | null;
  retiredRegister: string[];
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
 */
export function rotate(input: RotateInput): RotateResult | ParseError[] {
  const retiredRegister =
    input.register === undefined ? [] : splitRegister(input.register, input.year).moved;

  const blocks = splitEntryBlocks(input.hot);
  const entryBlocks = blocks.filter((block) => isEntryBlock(block.text));
  if (entryBlocks.length <= HOT_LIMIT) {
    return {
      hot: input.hot,
      archive: input.archive,
      index: input.index,
      rotated: null,
      retiredRegister,
    };
  }

  const parsedBlocks = entryBlocks.map((block) => ({ block, parsed: parseEntry(block.text) }));
  const candidateBlock = entryBlocks[entryBlocks.length - 1];
  const candidateKey = planKeyOf(candidateBlock.text);

  // Every blocking error keeps the entry that owns it, so a refusal can say where to look.
  const blocking = parsedBlocks.flatMap(({ block, parsed }) =>
    isParseError(parsed) ? parsed.map((error) => ({ error, owner: planKeyOf(block.text) })) : [],
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

  const archived = normalize(input.archive).trim();
  const archive =
    archived === '' ? candidateBlock.text : `${candidateBlock.text}${SEPARATOR}${archived}`;

  const current = normalize(input.index).trim();
  const row = formatIndexRow(rotated);
  const present = current
    .split('\n')
    .some((line) => line.trim().startsWith(`${rotated.date} · ${indexPlanKey(rotated)} ·`));
  const index = present ? current : current === '' ? row : `${row}\n${current}`;

  return { hot, archive, index, rotated, retiredRegister };
}

/**
 * Reads the hot record, its yearly archive, the INDEX and the register, then rotates. Exit 1 when
 * the record refuses to rotate (parse error or undisposed bullet), else 0.
 */
export function main(argv: string[] = process.argv.slice(2)): number {
  if (argv.length > 0) {
    console.error(`retro-rotate: unknown argument "${argv[0]}" — rotation takes no options`);
    return 1;
  }

  const today = localToday();
  const year = today.slice(0, 4);
  const archivePath = `${ARCHIVE_DIR}/${year}.md`;
  const registerArchivePath = `${ARCHIVE_DIR}/register-${year}.md`;

  const hot = readOptional(RECORD_PATH);
  if (hot.trim() === '') {
    console.error(`retro-rotate: ${RECORD_PATH} has no entries`);
    return 1;
  }

  const register = readOptional(REGISTER_PATH);
  const result = rotate({
    hot,
    archive: readOptional(archivePath),
    index: readOptional(INDEX_PATH),
    year,
    today,
    register,
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

  if (result.retiredRegister.length > 0) {
    const { kept } = splitRegister(register, year);
    write(REGISTER_PATH, kept);
    const rows = result.retiredRegister.join('\n');
    const existing = readOptional(registerArchivePath).trimEnd();
    write(registerArchivePath, existing === '' ? rows : `${existing}\n${rows}`);
    console.log(`retired ${result.retiredRegister.length} register rows → ${registerArchivePath}`);
  }

  if (result.rotated === null) {
    console.log(
      `retro-rotate: ${RECORD_PATH} still holds ${HOT_LIMIT} entries — nothing to rotate`,
    );
    return 0;
  }

  write(RECORD_PATH, result.hot);
  write(archivePath, result.archive);
  write(INDEX_PATH, result.index);
  console.log(`rotated ${result.rotated.date} · ${result.rotated.planKey} → ${archivePath}`);
  return 0;
}

/**
 * Splits the register's closed and retired tables: rows dated before `<year>-01-01` move out,
 * everything else (headings, header rows, other sections) is kept verbatim.
 */
function splitRegister(text: string, year: string): { kept: string; moved: string[] } {
  const cutoff = `${year}-01-01`;
  const kept: string[] = [];
  const moved: string[] = [];

  let section: string | null = null;
  let dateColumn = -1;

  for (const raw of normalize(text).split('\n')) {
    const line = raw.trim();

    if (line.startsWith('## ')) {
      section = line.slice(3).trim();
      dateColumn = -1;
      kept.push(raw);
      continue;
    }

    const columnName = section === null ? undefined : REGISTER_DATE_COLUMNS[section];
    if (columnName === undefined || !line.startsWith('|')) {
      kept.push(raw);
      continue;
    }

    const cells = rowCells(line);
    if (dateColumn === -1) {
      dateColumn = cells.map((cell) => cell.toLowerCase()).indexOf(columnName);
      kept.push(raw);
      continue;
    }
    if (cells.length > 0 && cells.every((cell) => ROW_SEPARATOR_RE.test(cell))) {
      kept.push(raw);
      continue;
    }

    const date = cells[dateColumn] ?? '';
    if (date !== '' && date < cutoff) {
      moved.push(line);
      continue;
    }
    kept.push(raw);
  }

  return { kept: kept.join('\n'), moved };
}

/**
 * A blocking parse error is reported as `<planKey>: <reason> — line N, in <owner>`: the plan key of
 * the entry whose rotation is blocked comes first (R13: the refusal names the blocked rotation),
 * and the entry that owns the offending line follows, so an operator never inspects a clean entry.
 * The mandated prefix stays byte-identical; the owning entry is appended.
 */
function refuse(
  blocking: Array<{ error: ParseError; owner: string }>,
  planKey: string,
): ParseError[] {
  return blocking.map(({ error, owner }) =>
    UNDISPOSED_RE.test(error.message)
      ? {
          line: error.line,
          message: `${planKey}: ${error.message.replace(LINE_PREFIX_RE, '')} (line ${error.line}${
            owner === planKey ? '' : `, in ${owner}`
          })`,
        }
      : error,
  );
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
