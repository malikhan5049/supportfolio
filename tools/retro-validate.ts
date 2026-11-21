/**
 * Validator for the retrospective records: the hot entry record, the action register, the
 * cross-file rule that every ID cited by an entry exists in the register, the hot/archive/INDEX
 * pair, the planning gate, the ROADMAP join, and the rulings grammar.
 *
 * `main` is the CLI surface: it reads the given files (or the two records by default), prints one
 * `<path>:<line>: <message>` line per violation to stderr, and returns 0 or 1. The `validate*`
 * functions are the pure, per-file halves and return already-formatted lines so the caller only
 * has to print and merge them.
 */

import { existsSync, readdirSync, readFileSync } from 'fs';
import { basename, join } from 'path';

import {
  ADOPTION_DATE,
  formatIndexRow,
  isParseError,
  normalize,
  parseEntry,
  parseIndex,
  parsePlanCompliance,
  parseRegister,
  planDateFromFile,
  splitEntryBlocks,
  type Entry,
} from './retro-lib';

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

const PLAN_FILE_RE = /^\d{4}-\d{2}-\d{2}-[^\\/]+\.md$/;

const PLAN_DATE_HEADER_RE = /^\*\*Date:\*\*\s*(\d{4}-\d{2}-\d{2})\s*$/m;

const RULING_HEADING_RE = /^## \d{4}-\d{2}-\d{2}\s*·\s*Ruling\s*·\s*.+$/;

const EXEMPT_PREFIXES = ['retro: exempt —', 'retro: exempt -'];

const DATE_COLUMN: Record<string, string> = {
  'Open actions': 'opened',
  'Active practices': 'since',
  'Closed and dropped actions': 'date',
  'Retired practices': 'retired',
};

/** Which validator owns a file; `main` dispatches on this and nothing else. */
type Kind = 'register' | 'index' | 'entry' | 'archive' | 'plan' | 'roadmap' | 'rulings';

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
 * Rule 6: an entry lives in exactly one place. No plan key may appear in both the hot record
 * and the archive, and INDEX must carry exactly one row per archived entry, in the canonical
 * `formatIndexRow` shape. The three arguments are file contents.
 */
export function validateArchivePair(hot: string, archive: string, index: string): string[] {
  const violations: string[] = [];
  const hotEntries = parsedEntries(hot);
  const archived = parsedEntries(archive);

  const archivedKeys = new Set(archived.map((entry) => entry.planKey));
  for (const entry of hotEntries) {
    if (archivedKeys.has(entry.planKey)) {
      violations.push(`plan key "${entry.planKey}" appears in both the hot record and the archive`);
    }
  }

  const rows = parseIndex(index);
  if (rows.length !== archived.length) {
    violations.push(`INDEX has ${rows.length} rows for ${archived.length} archived entries`);
  }

  const indexLines = normalize(index).split('\n');
  const expected = new Map(archived.map((entry) => [entryKey(entry), formatIndexRow(entry)]));

  for (const entry of archived) {
    const key = entryKey(entry);
    const row = rows.find((candidate) => `${candidate.date} · ${candidate.planKey}` === key);
    if (row === undefined) {
      violations.push(`INDEX is missing a row for ${key}`);
      continue;
    }
    const line = (indexLines[row.line - 1] ?? '').trim();
    if (line !== expected.get(key)) {
      violations.push(`INDEX row ${key} does not match the archived entry`);
    }
  }

  for (const row of rows) {
    const key = `${row.date} · ${row.planKey}`;
    if (!expected.has(key)) violations.push(`INDEX row ${key} has no archived entry`);
  }

  return violations;
}

/**
 * Rule 8: a plan dated after the adoption date must account for every RA/RP open on that date
 * in its `## Retrospective compliance` table; a deferral must say why. A `**Date:**` header that
 * disagrees with the filename makes the plan date unknowable, so that is reported and nothing
 * else is checked.
 */
export function validatePlan(
  path: string,
  text: string,
  openIdsAt: (date: string) => string[],
): string[] {
  const normalized = normalize(text);
  const header = PLAN_DATE_HEADER_RE.exec(normalized);
  const fileDate = planDateFromFile(path);

  if (header !== null && fileDate !== null && header[1] !== fileDate) {
    const line = normalized.slice(0, header.index).split('\n').length;
    return [violation(path, line, `Date: ${header[1]} contradicts filename date ${fileDate}`)];
  }

  const date = fileDate ?? (header === null ? null : header[1]);
  if (date === null || date <= ADOPTION_DATE) return [];

  const parsed = parsePlanCompliance(text);
  if (isParseError(parsed)) {
    return parsed.map((error) => violation(path, error.line, stripLinePrefix(error.message)));
  }

  const violations: string[] = [];
  const byId = new Map(parsed.rows.map((row) => [row.id, row]));

  for (const id of openIdsAt(date)) {
    const row = byId.get(id);
    if (row === undefined) {
      violations.push(violation(path, 1, `${id} missing from Retrospective compliance`));
    } else if (row.where.trim() === '') {
      violations.push(violation(path, 1, `${id}: missing where`));
    }
  }

  for (const row of parsed.rows) {
    if (row.disposition === 'deferred' && (row.reason ?? '').trim() === '') {
      violations.push(violation(path, 1, `${row.id} deferred without a reason`));
    }
  }

  return violations;
}

/**
 * Rule 9: every `done` ROADMAP row resolves to a retrospective entry (its `Retro` cell is a
 * `date/planKey` in `entryKeys`) or carries `retro: exempt — <reason>`.
 */
export function validateRoadmap(path: string, text: string, entryKeys: Set<string>): string[] {
  const violations: string[] = [];
  let header: string[] | null = null;
  let planAt = -1;
  let statusAt = -1;
  let retroAt = -1;

  normalize(text)
    .split('\n')
    .forEach((raw, index) => {
      const line = raw.trim();
      if (line === '') return;

      if (!line.startsWith('|')) {
        header = null;
        planAt = -1;
        statusAt = -1;
        retroAt = -1;
        return;
      }

      const cells = splitRow(line);
      if (cells.length > 0 && cells.every((cell) => SEPARATOR_CELL_RE.test(cell))) return;

      if (header === null) {
        header = cells.map((cell) => cell.toLowerCase());
        planAt = header.indexOf('plan');
        statusAt = header.indexOf('status');
        retroAt = header.indexOf('retro');
        return;
      }

      if (planAt === -1 || statusAt === -1 || retroAt === -1) return;
      if ((cells[statusAt] ?? '').toLowerCase() !== 'done') return;

      const plan = cells[planAt] ?? '';
      const retro = cells[retroAt] ?? '';
      if (entryKeys.has(retro)) return;
      if (EXEMPT_PREFIXES.some((prefix) => retro.startsWith(prefix))) return;

      violations.push(
        violation(
          path,
          index + 1,
          `${plan}: no retrospective entry and no "retro: exempt" — <reason>`,
        ),
      );
    });

  return violations;
}

/** Rule 10: every `## ` heading in the rulings file matches `## YYYY-MM-DD · Ruling · <task>`. */
export function validateRulings(path: string, text: string): string[] {
  const violations: string[] = [];

  normalize(text)
    .split('\n')
    .forEach((raw, index) => {
      const line = raw.trim();
      if (!line.startsWith('## ') || RULING_HEADING_RE.test(line)) return;
      violations.push(
        violation(
          path,
          index + 1,
          `heading does not match "## YYYY-MM-DD · Ruling · <task>": ${line}`,
        ),
      );
    });

  return violations;
}

/**
 * Validates the given files, or the two records by default. Returns the process exit code: 0 when
 * nothing was reported, 1 otherwise. Every cited ID is checked against the register; validating
 * entry files without one is itself a violation, so a missing register can never pass silently.
 *
 * `opts.all` widens the scan scope only (the two records, every plan, the archive, INDEX,
 * ROADMAP and the rulings); no rule changes, and the hot cap in particular applies to every
 * entry file. Explicit paths always win over the wider default scope.
 */
export function main(paths?: string[], opts: { all?: boolean } = {}): number {
  const explicit = paths !== undefined;
  const targets = paths ?? (opts.all === true ? allTargets() : DEFAULT_TARGETS);
  const violations: string[] = [];
  const files: Array<{ path: string; text: string; kind: Kind }> = [];

  for (const path of targets) {
    let text: string;
    try {
      text = readFileSync(path, 'utf8');
    } catch (error) {
      // An implicit --all target that does not exist yet is not a violation.
      if (explicit || opts.all !== true) {
        violations.push(violation(path, 1, `cannot read file: ${(error as Error).message}`));
      }
      continue;
    }
    files.push({ path, text, kind: classify(path, text) });
  }

  const registerFiles = files.filter((file) => file.kind === 'register');
  const registerIds = new Set<string>();
  let registerRowCount = 0;
  for (const file of registerFiles) {
    violations.push(...validateRegister(file.path, file.text));
    const rows = readRegisterRows(file.text);
    registerRowCount += rows.length;
    for (const row of rows) registerIds.add(row.id);
  }

  const entryFiles = files.filter((file) => file.kind === 'entry' || file.kind === 'archive');
  const entryKeys = new Set<string>();
  let entryCount = 0;
  for (const file of entryFiles) {
    violations.push(...validateEntries(file.path, file.text));
    entryCount += splitEntryBlocks(file.text).length;
    for (const entry of parsedEntries(file.text)) entryKeys.add(entryKey(entry));
  }

  if (registerFiles.length > 0) {
    for (const file of entryFiles) {
      violations.push(...checkReferences(file.path, file.text, registerIds));
    }
  } else if (entryFiles.length > 0) {
    violations.push(
      violation(entryFiles[0].path, 1, 'no register supplied; cross-file ID checks were skipped'),
    );
  }

  const openIdsAt = openIdsAtFromRegister(registerFiles.map((file) => file.text).join('\n'));
  for (const file of files) {
    if (file.kind === 'plan') violations.push(...validatePlan(file.path, file.text, openIdsAt));
    if (file.kind === 'roadmap')
      violations.push(...validateRoadmap(file.path, file.text, entryKeys));
    if (file.kind === 'rulings') violations.push(...validateRulings(file.path, file.text));
  }

  const hot = files.filter((file) => file.kind === 'entry');
  const archives = files.filter((file) => file.kind === 'archive');
  const index = files.find((file) => file.kind === 'index');
  if (index !== undefined && archives.length > 0) {
    const hotText = hot.map((file) => file.text).join('\n\n---\n\n');
    for (const archive of archives) {
      for (const message of validateArchivePair(hotText, archive.text, index.text)) {
        violations.push(violation(archive.path, 1, message));
      }
    }
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

function classify(path: string, text: string): Kind {
  const normalizedPath = normalize(path);
  const name = basename(normalizedPath);
  if (name === 'INDEX.md') return 'index';
  if (name === 'retro-actions.md') return 'register';
  if (name === 'ROADMAP.md') return 'roadmap';
  if (name === 'rulings.md') return 'rulings';
  // Snapshots and fixtures are named freely; a file that carries the register's own section
  // headings is a register, and an entry can never contain them.
  if (REGISTER_HEADING_RE.test(normalize(text))) return 'register';
  if (/[\\/]plans[\\/][^\\/]+\.md$/.test(normalizedPath)) return 'plan';
  if (/[\\/]archive[\\/][^\\/]+\.md$/.test(normalizedPath)) return 'archive';
  if (PLAN_FILE_RE.test(name)) return 'plan';
  return 'entry';
}

/** The wider `--all` scope: the default records plus every file that exists among the rest. */
function allTargets(): string[] {
  const targets = [...DEFAULT_TARGETS];
  const plansDir = join('docs', 'superpowers', 'plans');
  const archiveDir = join('docs', 'superpowers', 'retro', 'archive');

  for (const dir of [plansDir, archiveDir]) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (name.endsWith('.md')) targets.push(join(dir, name));
    }
  }

  for (const extra of [
    join('docs', 'superpowers', 'ROADMAP.md'),
    join('docs', 'superpowers', 'rulings.md'),
  ]) {
    if (existsSync(extra)) targets.push(extra);
  }

  return targets;
}

/** Every block that parses, in order; blocks with findings are reported elsewhere. */
function parsedEntries(text: string): Entry[] {
  const entries: Entry[] = [];
  for (const block of splitEntryBlocks(text)) {
    const entry = parseEntry(block.text);
    if (!isParseError(entry)) entries.push(entry);
  }
  return entries;
}

/** The ROADMAP and INDEX join key, `<date>/<planKey>`. */
function entryKey(entry: Entry): string {
  return `${entry.date}/${entry.planKey}`;
}

/**
 * Builds rule 8's `openIdsAt` from the register. An ID was open on `date` when it is still in an
 * open table that started on or before `date`, or already sits in a closed table dated after it.
 */
function openIdsAtFromRegister(text: string): (date: string) => string[] {
  const rows = readRegisterRows(text);

  return (date) => {
    const ids: string[] = [];
    for (const row of rows) {
      const column = DATE_COLUMN[row.section];
      if (column === undefined) continue;
      const at = row.header.indexOf(column);
      const when = at === -1 ? '' : (row.cells[at] ?? '');
      if (when === '') continue;

      const openSection = row.section === 'Open actions' || row.section === 'Active practices';
      if (openSection ? when <= date : when > date) ids.push(row.id);
    }
    return ids.sort();
  };
}

/** Splits a markdown table row into trimmed cells, dropping the outer pipes. */
function splitRow(line: string): string[] {
  const cells = line.split('|').map((cell) => cell.trim());
  if (cells.length > 0 && cells[0] === '') cells.shift();
  if (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();
  return cells;
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
