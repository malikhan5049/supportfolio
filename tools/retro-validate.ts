/**
 * Validator for the retrospective records: the hot entry record, the action register, and the
 * cross-file rule that every ID cited by an entry exists in the register.
 *
 * `main` is the CLI surface: it reads the given files (or the two records by default), prints one
 * `<path>:<line>: <message>` line per violation to stderr, and returns 0 or 1. `validateEntries`
 * and `validateRegister` are the pure, per-file halves and return already-formatted lines so the
 * caller only has to print and merge them.
 */

import { readFileSync } from 'fs';
import { basename } from 'path';

import { isParseError, normalize, parseEntry, parseRegister, splitEntryBlocks } from './retro-lib';

/** The hot record keeps the newest three entries; older ones move to the plan's own record. */
export const MAX_HOT_ENTRIES = 3;
/** One entry may cite at most three new actions or practices. */
export const MAX_NEW_IDS = 3;
/** An action may be carried across at most three retros before it must be closed or dropped. */
export const MAX_CARRIED = 3;

const DEFAULT_TARGETS = ['docs/superpowers/retrospectives.md', 'docs/superpowers/retro-actions.md'];

const HEADING_RE =
  /^## (\d{4}-\d{2}-\d{2})\s*·\s*(Plan \d+|Ad-hoc)\s*·\s*([a-z0-9-]+)(?:\s*·\s*PR #(\d+))?$/;

const SEPARATOR_CELL_RE = /^:?-{3,}:?$/;

const REGISTER_HEADING_RE =
  /^## (?:Open actions|Active practices|Closed and dropped actions|Retired practices)\s*$/m;

const DISPOSITION_ID_RE = /→\s*((?:RP|RA)-\d{3})\s*$/;

const REVIEW_ID_RE = /^-\s+((?:RP|RA)-\d{3})\s+[–—-]\s+(?:closed|kept|amended|retired|carried)\b/;

/** One data row of a register table, kept verbatim so rule 7 can check cells the parser rejects. */
type RegisterRow = {
  section: string;
  id: string;
  cells: string[];
  header: string[];
  line: number;
};

/**
 * Validates one entry file (rules 1, 2, 3 and 5). The hot cap is unconditional: no option or
 * caller can widen an entry file past {@link MAX_HOT_ENTRIES}.
 */
export function validateEntries(path: string, text: string): string[] {
  const violations: string[] = [];
  const blocks = splitEntryBlocks(text);

  if (blocks.length > MAX_HOT_ENTRIES) {
    violations.push(
      violation(
        path,
        blocks[0].startLine,
        `${blocks.length} entries in the hot record; cap is ${MAX_HOT_ENTRIES}`,
      ),
    );
  }

  const planKeys = new Set<string>();
  let previousDate: string | null = null;

  for (const block of blocks) {
    const firstLine = normalize(block.text).split('\n')[0].trim();
    const heading = HEADING_RE.exec(firstLine);
    if (!heading) {
      violations.push(
        violation(
          path,
          block.startLine,
          `heading does not match "## <date> · <planKey> · <slug>[ · PR #<n>]": ${firstLine}`,
        ),
      );
      // A block without a valid heading cannot be parsed, so its remaining rules are unknowable.
      continue;
    }

    const date = heading[1];
    const planKey = heading[2];

    if (previousDate !== null && date > previousDate) {
      violations.push(
        violation(
          path,
          block.startLine,
          `entries are not newest-first: ${date} follows ${previousDate}`,
        ),
      );
    }
    previousDate = date;

    if (planKeys.has(planKey)) {
      violations.push(violation(path, block.startLine, `duplicate plan key "${planKey}"`));
    }
    planKeys.add(planKey);

    const entry = parseEntry(block.text);
    if (isParseError(entry)) {
      // Rule 3: the parser's own findings (headline, sections, disposition tags) are re-emitted
      // against the file, with the block offset added and the embedded `line N:` removed.
      for (const error of entry) {
        violations.push(
          violation(path, error.line + block.startLine - 1, stripLinePrefix(error.message)),
        );
      }
      continue;
    }

    if (entry.migrated) continue;

    if (!entry.sections.some((section) => section.title === 'Previous actions reviewed')) {
      violations.push(
        violation(
          path,
          block.startLine,
          'required section "Previous actions reviewed" is missing (mark the entry **migrated:** true to opt out)',
        ),
      );
    }

    const newIds = new Set(
      entry.sections
        .flatMap((section) => section.bullets)
        .map((bullet) => bullet.disposition.id)
        .filter((id): id is string => id !== undefined),
    );
    if (newIds.size > MAX_NEW_IDS) {
      violations.push(
        violation(
          path,
          block.startLine,
          `entry cites ${newIds.size} new IDs (${Array.from(newIds).join(
            ', ',
          )}); max is ${MAX_NEW_IDS}`,
        ),
      );
    }
  }

  return violations;
}

/**
 * Validates the action register (rule 7). The parser owns duplicate IDs, unknown statuses and
 * rows missing a date/evidence/reason; the cell values it cannot check (`Carried`, ID order) and
 * its own findings are reported here.
 */
export function validateRegister(path: string, text: string): string[] {
  const violations: string[] = [];
  const rows = readRegisterRows(text);

  const parsed = parseRegister(text);
  if (isParseError(parsed)) {
    for (const error of parsed) {
      violations.push(violation(path, error.line, stripLinePrefix(error.message)));
    }
  }

  const lastNumberBySeries = new Map<string, number>();

  for (const row of rows) {
    if (row.section === 'Open actions') {
      const carriedAt = row.header.indexOf('carried');
      const raw = carriedAt === -1 ? '' : (row.cells[carriedAt] ?? '');
      const carried = Number(raw);
      if (raw !== '' && Number.isInteger(carried) && carried > MAX_CARRIED) {
        violations.push(
          violation(path, row.line, `${row.id}: Carried is ${carried}; max is ${MAX_CARRIED}`),
        );
      }
    }

    const series = /^((?:RP|RA))-(\d{3})$/.exec(row.id);
    if (!series) continue;
    const key = `${row.section}/${series[1]}`;
    const number = Number(series[2]);
    const last = lastNumberBySeries.get(key);
    if (last !== undefined && number <= last) {
      violations.push(
        violation(
          path,
          row.line,
          `${row.id}: ID is not increasing within "${row.section}" (previous was ${series[1]}-${String(
            last,
          ).padStart(3, '0')})`,
        ),
      );
    } else {
      lastNumberBySeries.set(key, number);
    }
  }

  return violations;
}

/**
 * Validates the given files, or the two records by default. Returns the process exit code: 0 when
 * nothing was reported, 1 otherwise. Every cited ID is checked against the register; validating
 * entry files without one is itself a violation, so a missing register can never pass silently.
 *
 * `_opts.all` is reserved for a wider scan scope and is deliberately unread here: no option
 * changes a rule, and the hot cap in particular applies to every entry file.
 */
export function main(paths: string[] = DEFAULT_TARGETS, _opts: { all?: boolean } = {}): number {
  const violations: string[] = [];
  const entries: Array<{ path: string; text: string }> = [];
  const registerIds = new Set<string>();
  let entryCount = 0;
  let registerRowCount = 0;
  let hasRegister = false;

  for (const path of paths) {
    let text: string;
    try {
      text = readFileSync(path, 'utf8');
    } catch (error) {
      violations.push(violation(path, 1, `cannot read file: ${(error as Error).message}`));
      continue;
    }

    switch (classify(path, text)) {
      case 'register': {
        hasRegister = true;
        violations.push(...validateRegister(path, text));
        const rows = readRegisterRows(text);
        registerRowCount += rows.length;
        for (const row of rows) registerIds.add(row.id);
        break;
      }
      case 'index':
        // Index rules are not part of this validator yet; the file is still read so that a
        // missing index is reported rather than silently skipped.
        break;
      default: {
        entries.push({ path, text });
        entryCount += splitEntryBlocks(text).length;
        violations.push(...validateEntries(path, text));
      }
    }
  }

  if (hasRegister) {
    for (const entry of entries) {
      violations.push(...checkReferences(entry.path, entry.text, registerIds));
    }
  } else if (entries.length > 0) {
    violations.push(
      violation(entries[0].path, 1, 'no register supplied; cross-file ID checks were skipped'),
    );
  }

  if (violations.length > 0) {
    for (const item of violations) console.error(item);
    return 1;
  }

  console.log(`retro: OK (${entryCount} entries, ${registerRowCount} register rows)`);
  return 0;
}

/** Rule 4: every disposition and review ID cited by an entry must exist in the register. */
function checkReferences(path: string, text: string, ids: Set<string>): string[] {
  const violations: string[] = [];

  normalize(text)
    .split('\n')
    .forEach((raw, index) => {
      const line = raw.trim();
      if (!line.startsWith('-')) return;
      const cited = DISPOSITION_ID_RE.exec(line) ?? REVIEW_ID_RE.exec(line);
      if (cited !== null && !ids.has(cited[1])) {
        violations.push(violation(path, index + 1, `${cited[1]}: not in the register`));
      }
    });

  return violations;
}

function classify(path: string, text: string): 'register' | 'index' | 'entry' {
  const name = basename(path);
  if (name === 'INDEX.md') return 'index';
  if (name === 'retro-actions.md') return 'register';
  // Snapshots and fixtures are named freely; a file that carries the register's own section
  // headings is a register, and an entry can never contain them.
  return REGISTER_HEADING_RE.test(normalize(text)) ? 'register' : 'entry';
}

/** Every data row of every register table, header included, without relying on a clean parse. */
function readRegisterRows(text: string): RegisterRow[] {
  const rows: RegisterRow[] = [];
  let section: string | null = null;
  let header: string[] | null = null;

  normalize(text)
    .split('\n')
    .forEach((raw, index) => {
      const line = raw.trim();
      if (line === '') return;

      if (line.startsWith('## ')) {
        section = line.slice(3).trim();
        header = null;
        return;
      }
      if (!line.startsWith('|') || section === null) return;

      const cells = line.split('|').map((cell) => cell.trim());
      if (cells.length > 0 && cells[0] === '') cells.shift();
      if (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();
      if (cells.length > 0 && cells.every((cell) => SEPARATOR_CELL_RE.test(cell))) return;

      if (header === null) {
        header = cells.map((cell) => cell.toLowerCase());
        return;
      }

      const idAt = header.indexOf('id');
      rows.push({
        section,
        id: idAt === -1 ? '' : (cells[idAt] ?? ''),
        cells,
        header,
        line: index + 1,
      });
    });

  return rows;
}

function violation(path: string, line: number, message: string): string {
  return `${path}:${line}: ${message}`;
}

/** `ParseError.message` already repeats `line N: `; the printed line carries its own. */
function stripLinePrefix(message: string): string {
  return message.replace(/^line \d+: /, '');
}
