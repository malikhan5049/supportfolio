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
import { basename } from 'path';

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

const ROADMAP_PATH = 'docs/superpowers/ROADMAP.md';
const RULINGS_PATH = 'docs/superpowers/rulings.md';
const INDEX_PATH = 'docs/superpowers/retro/archive/INDEX.md';
const PLANS_DIR = 'docs/superpowers/plans';
const ARCHIVE_DIR = 'docs/superpowers/retro/archive';

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

const DATE_COLUMNS: Record<string, { column: string; label: string }> = {
  'Open actions': { column: 'opened', label: 'Opened' },
  'Active practices': { column: 'since', label: 'Since' },
  'Closed and dropped actions': { column: 'date', label: 'Date' },
  'Retired practices': { column: 'retired', label: 'Retired' },
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

  const indexLines = normalize(index).split('\n');
  const rows = parseIndex(index).map((row) => ({
    key: `${row.date}/${row.planKey}`,
    display: `${row.date} · ${row.planKey}`,
    line: (indexLines[row.line - 1] ?? '').trim(),
  }));

  if (rows.length !== archived.length) {
    violations.push(`INDEX has ${rows.length} rows for ${archived.length} archived entries`);
  }

  const expected = new Map(
    archived.map((entry) => [
      entryKey(entry),
      { entry, display: `${entry.date} · ${entry.planKey}` },
    ]),
  );

  for (const [key, item] of expected) {
    const row = rows.find((candidate) => candidate.key === key);
    if (row === undefined) {
      violations.push(`INDEX is missing a row for ${item.display}`);
      continue;
    }
    if (row.line !== formatIndexRow(item.entry)) {
      violations.push(`INDEX row ${item.display} does not match the archived entry`);
    }
  }

  for (const row of rows) {
    if (!expected.has(row.key)) violations.push(`INDEX row ${row.display} has no archived entry`);
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
 * entry files or plans without one is itself a violation, so a missing register can never pass
 * silently.
 *
 * `opts.all` widens the scan scope only (the two records, INDEX, every plan, the archive, ROADMAP
 * and the rulings); no rule changes, and the hot cap in particular applies to every entry file.
 * Explicit paths always win over the wider default scope. Under `--all` the records, INDEX,
 * ROADMAP and rulings are required (their absence is a violation) while individual plans and
 * archive files are optional.
 */
export function main(paths?: string[], opts: { all?: boolean } = {}): number {
  const targets =
    paths === undefined ? scanTargets(opts) : paths.map((path) => ({ path, optional: false }));
  const violations: string[] = [];
  const files: Array<{ path: string; text: string; kind: Kind }> = [];

  for (const target of targets) {
    let text: string;
    try {
      text = readFileSync(target.path, 'utf8');
    } catch (error) {
      // An optional --all extra that does not exist is not a violation; a missing record is.
      if (!target.optional) {
        violations.push(violation(target.path, 1, `cannot read file: ${(error as Error).message}`));
      }
      continue;
    }
    files.push({ path: target.path, text, kind: classify(target.path, text) });
  }

  const registerFiles = files.filter((file) => file.kind === 'register');
  const registerIds = new Set<string>();
  let registerRowCount = 0;
  for (const file of registerFiles) {
    violations.push(...validateRegister(file.path, file.text));
    violations.push(...validateRegisterDateColumns(file.path, file.text));
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

  const planFiles = files.filter((file) => file.kind === 'plan');
  const openIdsAt = openIdsAtFromRegister(registerFiles.map((file) => file.text).join('\n'));
  for (const file of files) {
    if (file.kind === 'plan') violations.push(...validatePlan(file.path, file.text, openIdsAt));
    if (file.kind === 'roadmap')
      violations.push(...validateRoadmap(file.path, file.text, entryKeys));
    if (file.kind === 'rulings') violations.push(...validateRulings(file.path, file.text));
  }

  if (registerFiles.length === 0) {
    const gated = planFiles.filter((file) => isGatedPlan(file.path, file.text));
    if (gated.length > 0) {
      violations.push(
        violation(
          gated[0].path,
          1,
          'no register supplied; the plan gate cannot compute the open set',
        ),
      );
    }
  }

  const hot = files.filter((file) => file.kind === 'entry');
  const archives = files.filter((file) => file.kind === 'archive');
  const index = files.find((file) => file.kind === 'index');
  if (archives.length > 0) {
    if (index === undefined) {
      violations.push(
        violation(archives[0].path, 1, 'no INDEX supplied; rule 6 cannot check the archive'),
      );
    } else {
      // The INDEX is global: pair it with the whole archive once, never per archive file.
      const hotText = hot.map((file) => file.text).join('\n\n---\n\n');
      const archiveText = archives.map((file) => file.text).join('\n\n---\n\n');
      for (const message of validateArchivePair(hotText, archiveText, index.text)) {
        violations.push(violation(index.path, 1, message));
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

/**
 * The `--all` scope. The records, INDEX, ROADMAP and rulings are required; individual plans and
 * archive files are optional so a repository that has not archived anything yet still validates.
 */
function scanTargets(opts: { all?: boolean }): Array<{ path: string; optional: boolean }> {
  if (opts.all !== true) return DEFAULT_TARGETS.map((path) => ({ path, optional: false }));

  const targets = [...DEFAULT_TARGETS, INDEX_PATH, ROADMAP_PATH, RULINGS_PATH].map((path) => ({
    path,
    optional: false,
  }));
  const seen = new Set(targets.map((target) => target.path));

  for (const dir of [PLANS_DIR, ARCHIVE_DIR]) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      const path = `${dir}/${name}`;
      if (!name.endsWith('.md') || seen.has(path)) continue;
      seen.add(path);
      targets.push({ path, optional: true });
    }
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
 * Rule 8's plan gate applies only after the adoption date. A plan whose date cannot be read is
 * left to `validatePlan` (which exempts it).
 */
function isGatedPlan(path: string, text: string): boolean {
  const header = PLAN_DATE_HEADER_RE.exec(normalize(text));
  const date = planDateFromFile(path) ?? (header === null ? null : header[1]);
  return date !== null && date > ADOPTION_DATE;
}

/**
 * The register's date columns are fixed by the design (§8.3). A table whose header omits the
 * column `openIdsAt` needs would otherwise make the plan gate silently weaker, so it is a
 * violation naming the table.
 */
function validateRegisterDateColumns(path: string, text: string): string[] {
  const violations: string[] = [];
  let section: string | null = null;
  let headerSeen = false;

  normalize(text)
    .split('\n')
    .forEach((raw, index) => {
      const line = raw.trim();
      if (line === '') return;

      if (line.startsWith('## ')) {
        section = line.slice(3).trim();
        headerSeen = false;
        return;
      }
      if (!line.startsWith('|') || headerSeen) return;

      const cells = splitRow(line);
      if (cells.length > 0 && cells.every((cell) => SEPARATOR_CELL_RE.test(cell))) return;

      headerSeen = true;
      if (section === null) return;
      const expected = DATE_COLUMNS[section];
      // An unexpected section is already reported by `parseRegister`.
      if (expected === undefined) return;

      const header = cells.map((cell) => cell.toLowerCase());
      if (!header.includes(expected.column)) {
        violations.push(violation(path, index + 1, `${section}: no "${expected.label}" column`));
      }
    });

  return violations;
}

/**
 * Builds rule 8's `openIdsAt` from the register. An ID was open on `date` when it is still in an
 * open table that started on or before `date`, or already sits in a closed table dated after it.
 * A table without its date column contributes nothing; `validateRegisterDateColumns` reports it.
 */
function openIdsAtFromRegister(text: string): (date: string) => string[] {
  const rows = readRegisterRows(text);

  return (date) => {
    const ids: string[] = [];
    for (const row of rows) {
      const expected = DATE_COLUMNS[row.section];
      if (expected === undefined) continue;
      const at = row.header.indexOf(expected.column);
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
