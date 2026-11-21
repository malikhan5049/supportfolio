/**
 * Shared types and parsers for the retrospective system.
 *
 * Every parser is total: it returns either the parsed value or the complete list of
 * {@link ParseError}s and never throws. `ParseError.message` repeats the `line N:` prefix so
 * a bare `error.message` is readable on its own.
 */

export const ADOPTION_DATE = '2026-11-22';

export type ParseError = { file?: string; line: number; message: string };

export type Disposition = { id?: string; contextOnly: boolean };

export type Bullet = { text: string; disposition: Disposition };

export type SectionTitle =
  | 'Previous actions reviewed'
  | 'What went well?'
  | 'What would we like to continue doing?'
  | 'What would we like to stop doing?'
  | 'Metrics'
  | 'Retro of the retro';

export type Section = { title: SectionTitle; bullets: Bullet[] };

export type ReviewItem = {
  id: string;
  status: 'closed' | 'kept' | 'amended' | 'retired' | 'carried';
  note?: string;
};

export type Entry = {
  date: string;
  planKey: string;
  slug: string;
  prNumber: number | null;
  headline: string;
  reviewed: ReviewItem[];
  sections: Section[];
  metrics: string;
  migrated: boolean;
  line: number;
};

export type OpenAction = {
  id: string;
  action: string;
  owner: string;
  opened: string;
  doneWhen: string;
  carried: number;
  status: 'open';
};

export type ActivePractice = {
  id: string;
  practice: string;
  source: string;
  since: string;
  status: 'active';
};

export type ClosedAction = {
  id: string;
  outcome: 'closed' | 'dropped';
  date: string;
  evidence: string;
};

export type RetiredPractice = { id: string; retired: string; reason: string };

export type Register = {
  openActions: OpenAction[];
  practices: ActivePractice[];
  closedActions: ClosedAction[];
  retiredPractices: RetiredPractice[];
};

export type IndexRow = {
  date: string;
  planKey: string;
  prNumber: number | null;
  headline: string;
  ids: string[];
  line: number;
};

export type ComplianceRow = {
  id: string;
  kind: 'practice' | 'action';
  disposition: 'applied' | 'deferred';
  where: string;
  reason?: string;
};

export type ComplianceTable = { briefRun: string | null; rows: ComplianceRow[] };

const SECTION_TITLES: SectionTitle[] = [
  'Previous actions reviewed',
  'What went well?',
  'What would we like to continue doing?',
  'What would we like to stop doing?',
  'Metrics',
  'Retro of the retro',
];

const REQUIRED_SECTIONS: SectionTitle[] = [
  'What went well?',
  'What would we like to continue doing?',
  'What would we like to stop doing?',
  'Metrics',
];

const REGISTER_SECTIONS = [
  'Open actions',
  'Active practices',
  'Closed and dropped actions',
  'Retired practices',
];

const HEADING_RE =
  /^## (\d{4}-\d{2}-\d{2})\s*·\s*(Plan \d+|Ad-hoc)\s*·\s*([a-z0-9-]+)(?:\s*·\s*PR #(\d+))?$/;

const REVIEW_RE =
  /^- ((?:RP|RA)-\d{3}) [\u2013\u2014-] (closed|kept|amended|retired|carried)(?: [\u2013\u2014-] (.+))?$/;

const MIGRATED_RE = /^\*\*migrated:\*\* true$/i;

const ID_RE = /^(?:RP|RA)-\d{3}$/;

const TAG_RE = /^(?:RP|RA)-\d{3}$/;

const METRICS_NOT_RECORDED = 'metrics: not recorded';

const METRICS_RE = /^tasks \d+ · retries \d+ · escaped defects \d+ · review \S+$/;

const SEPARATOR_CELL_RE = /^:?-{3,}:?$/;

const COMPLIANCE_HEADING_RE = /^##\s+Retrospective compliance\s*$/i;

const COMPLIANCE_COLUMNS = ['id', 'kind', 'disposition', 'where'];

/** `\r\n` and lone `\r` become `\n`. */
export function normalize(text: string): string {
  return text.replace(/\r\n?/g, '\n');
}

/** Splits a multi-entry document on `---` lines. `startLine` is 1-based on the normalized text. */
export function splitEntryBlocks(text: string): Array<{ text: string; startLine: number }> {
  const blocks: Array<{ text: string; startLine: number }> = [];
  let buffer: Array<{ line: string; number: number }> = [];

  const flush = (): void => {
    let first = 0;
    let last = buffer.length;
    while (first < last && isBlank(buffer[first].line)) first += 1;
    while (last > first && isBlank(buffer[last - 1].line)) last -= 1;
    if (first < last) {
      const slice = buffer.slice(first, last);
      blocks.push({
        text: slice.map((item) => item.line).join('\n'),
        startLine: slice[0].number,
      });
    }
    buffer = [];
  };

  normalize(text)
    .split('\n')
    .forEach((line, index) => {
      if (/^-{3,}\s*$/.test(line)) {
        flush();
        return;
      }
      buffer.push({ line, number: index + 1 });
    });
  flush();

  return blocks;
}

/** True when `value` is a `ParseError[]` (an empty array counts as an error list). */
export function isParseError(value: unknown): value is ParseError[] {
  return Array.isArray(value) && value.every(isParseErrorItem);
}

/**
 * Parses one entry block. For multi-entry documents call {@link splitEntryBlocks} first and
 * parse each block; only the first block is read here.
 */
export function parseEntry(text: string): Entry | ParseError[] {
  const blocks = splitEntryBlocks(normalize(text));
  if (blocks.length === 0) return [error(1, 'empty entry')];

  const block = blocks[0];
  const lines = block.text.split('\n');
  const errors: ParseError[] = [];
  const reviewed: ReviewItem[] = [];
  const sections: Section[] = [];
  const seen = new Set<SectionTitle>();

  let date = '';
  let planKey = '';
  let slug = '';
  let prNumber: number | null = null;
  let headline: string | null = null;
  let migrated = false;
  let metrics = '';
  let headingSeen = false;
  let lastSectionIndex = -1;
  let current: Section | null = null;

  lines.forEach((raw, offset) => {
    const lineNumber = block.startLine + offset;
    const line = raw.trim();
    if (line === '') return;

    if (line.startsWith('## ')) {
      const match = HEADING_RE.exec(line);
      if (!match) {
        errors.push(error(lineNumber, `malformed entry heading: ${line}`));
        return;
      }
      if (headingSeen) {
        errors.push(error(lineNumber, 'duplicate entry heading'));
        return;
      }
      headingSeen = true;
      date = match[1];
      planKey = match[2];
      slug = match[3];
      prNumber = match[4] === undefined ? null : Number(match[4]);
      return;
    }

    if (line.startsWith('### ')) {
      const title = line.slice(4).trim();
      const index = SECTION_TITLES.indexOf(title as SectionTitle);
      if (index === -1) {
        errors.push(error(lineNumber, `unexpected section "${title}"`));
        current = null;
        return;
      }
      const sectionTitle = SECTION_TITLES[index];
      if (seen.has(sectionTitle)) {
        errors.push(error(lineNumber, `duplicate section "${sectionTitle}"`));
        current = null;
        return;
      }
      if (index < lastSectionIndex) {
        errors.push(error(lineNumber, `unexpected section "${sectionTitle}"`));
      }
      const section: Section = { title: sectionTitle, bullets: [] };
      sections.push(section);
      seen.add(sectionTitle);
      lastSectionIndex = Math.max(lastSectionIndex, index);
      current = section;
      return;
    }

    if (/^\*\*headline:\*\*/i.test(line)) {
      const value = line.replace(/^\*\*headline:\*\*/i, '').trim();
      if (headline !== null) {
        errors.push(error(lineNumber, 'duplicate Headline: line'));
      } else if (value === '') {
        errors.push(error(lineNumber, 'missing Headline: value'));
      } else {
        headline = value;
      }
      return;
    }

    if (MIGRATED_RE.test(line)) {
      migrated = true;
      return;
    }

    if (current === null) {
      errors.push(error(lineNumber, `unexpected line "${line}"`));
      return;
    }

    if (current.title === 'Metrics') {
      if (metrics !== '') {
        errors.push(error(lineNumber, 'duplicate metrics line'));
        return;
      }
      metrics = line;
      if (!isMetricsLine(line)) {
        errors.push(error(lineNumber, `malformed metrics line: ${line}`));
      }
      return;
    }

    if (current.title === 'Previous actions reviewed') {
      const match = REVIEW_RE.exec(line);
      if (!match) {
        errors.push(error(lineNumber, `malformed review item: ${line}`));
        return;
      }
      const item: ReviewItem = { id: match[1], status: match[2] as ReviewItem['status'] };
      if (match[3] !== undefined) item.note = match[3].trim();
      reviewed.push(item);
      return;
    }

    if (!line.startsWith('-')) {
      errors.push(error(lineNumber, `unexpected line "${line}"`));
      return;
    }

    const bullet = parseBullet(line, lineNumber, errors);
    if (bullet) current.bullets.push(bullet);
  });

  if (!headingSeen) errors.push(error(block.startLine, 'missing entry heading'));
  if (headline === null) errors.push(error(block.startLine, 'missing Headline: line'));
  if (seen.has('Metrics') && metrics === '') {
    errors.push(error(block.startLine, 'missing metrics line'));
  }
  for (const title of REQUIRED_SECTIONS) {
    if (!seen.has(title)) {
      errors.push(error(block.startLine, `required section "${title}" is missing`));
    }
  }

  if (errors.length > 0 || headline === null) return errors;

  return {
    date,
    planKey,
    slug,
    prNumber,
    headline,
    reviewed,
    sections,
    metrics,
    migrated,
    line: block.startLine,
  };
}

/**
 * Parses the action register. An ID must be unique across all four tables: it may not repeat,
 * and it may not appear in more than one table (RA and RP namespaces are independent).
 */
export function parseRegister(text: string): Register | ParseError[] {
  const register: Register = {
    openActions: [],
    practices: [],
    closedActions: [],
    retiredPractices: [],
  };
  const errors: ParseError[] = [];
  const idTables = new Map<string, string>();
  let section: string | null = null;
  let header: string[] | null = null;

  normalize(text)
    .split('\n')
    .forEach((raw, index) => {
      const lineNumber = index + 1;
      const line = raw.trim();
      if (line === '') return;

      if (line.startsWith('## ')) {
        section = line.slice(3).trim();
        header = null;
        if (!REGISTER_SECTIONS.includes(section)) {
          errors.push(error(lineNumber, `unexpected section "${section}"`));
        }
        return;
      }

      if (line.startsWith('#')) return;

      if (!line.startsWith('|')) {
        errors.push(error(lineNumber, `unexpected line "${line}"`));
        return;
      }

      const cells = splitRow(line);
      if (cells.length > 0 && cells.every((cell) => SEPARATOR_CELL_RE.test(cell))) return;

      if (section === null) {
        errors.push(error(lineNumber, 'table row outside a section'));
        return;
      }

      if (header === null) {
        header = cells.map((cell) => cell.toLowerCase());
        return;
      }

      const rowHeader = header;
      const cell = (name: string): string => {
        const at = rowHeader.indexOf(name);
        return at === -1 ? '' : (cells[at] ?? '');
      };

      const id = cell('id');
      if (id === '') {
        errors.push(error(lineNumber, 'missing ID'));
        return;
      }
      if (!ID_RE.test(id)) {
        errors.push(error(lineNumber, `invalid ID "${id}"`));
        return;
      }
      const existingTable = idTables.get(id);
      if (existingTable !== undefined) {
        errors.push(
          error(
            lineNumber,
            existingTable === section
              ? `${id}: duplicate ID`
              : `${id}: appears in more than one table ("${existingTable}" and "${section}")`,
          ),
        );
        return;
      }
      idTables.set(id, section);

      switch (section) {
        case 'Open actions': {
          const action = cell('action');
          const owner = cell('owner');
          const opened = cell('opened');
          const doneWhen = cell('done when');
          const carriedRaw = cell('carried');
          const status = cell('status');
          const carried = Number(carriedRaw);

          if (action === '') errors.push(error(lineNumber, `${id}: missing action`));
          if (owner === '') errors.push(error(lineNumber, `${id}: missing owner`));
          if (opened === '') errors.push(error(lineNumber, `${id}: missing opened date`));
          if (doneWhen === '') errors.push(error(lineNumber, `${id}: missing done-when`));
          if (carriedRaw === '') {
            errors.push(error(lineNumber, `${id}: missing carried count`));
          } else if (!Number.isInteger(carried) || carried < 0) {
            errors.push(error(lineNumber, `${id}: carried is not a number`));
          }
          if (status !== 'open') {
            errors.push(error(lineNumber, `${id}: unknown status "${status}"`));
            return;
          }
          register.openActions.push({
            id,
            action,
            owner,
            opened,
            doneWhen,
            carried,
            status: 'open',
          });
          return;
        }
        case 'Active practices': {
          const practice = cell('practice');
          const source = cell('source');
          const since = cell('since');
          const status = cell('status');

          if (practice === '') errors.push(error(lineNumber, `${id}: missing practice`));
          if (source === '') errors.push(error(lineNumber, `${id}: missing source`));
          if (since === '') errors.push(error(lineNumber, `${id}: missing since date`));
          if (status !== 'active') {
            errors.push(error(lineNumber, `${id}: unknown status "${status}"`));
            return;
          }
          register.practices.push({ id, practice, source, since, status: 'active' });
          return;
        }
        case 'Closed and dropped actions': {
          const outcome = cell('outcome');
          const date = cell('date');
          const evidence = cell('evidence or reason');

          if (date === '') errors.push(error(lineNumber, `${id}: missing date`));
          if (evidence === '') errors.push(error(lineNumber, `${id}: missing evidence`));
          if (outcome !== 'closed' && outcome !== 'dropped') {
            errors.push(error(lineNumber, `${id}: unknown outcome "${outcome}"`));
            return;
          }
          register.closedActions.push({ id, outcome, date, evidence });
          return;
        }
        case 'Retired practices': {
          const retired = cell('retired');
          const reason = cell('reason');

          if (retired === '') errors.push(error(lineNumber, `${id}: missing retired date`));
          if (reason === '') errors.push(error(lineNumber, `${id}: missing reason`));
          register.retiredPractices.push({ id, retired, reason });
          return;
        }
        default:
          errors.push(error(lineNumber, `unexpected section "${section}"`));
      }
    });

  return errors.length > 0 ? errors : register;
}

/** Parses `INDEX.md`, one row per non-blank, non-heading line. Malformed lines are skipped. */
export function parseIndex(text: string): IndexRow[] {
  const rows: IndexRow[] = [];

  normalize(text)
    .split('\n')
    .forEach((raw, index) => {
      const line = raw.trim();
      if (line === '' || line.startsWith('#')) return;

      const parts = line.split('·').map((part) => part.trim());
      let date: string;
      let planKey: string;
      let prNumber: number | null = null;
      let headline: string;
      let idsPart: string;

      if (parts.length === 5 && /^PR #\d+$/.test(parts[2])) {
        date = parts[0];
        planKey = parts[1];
        prNumber = Number(parts[2].slice('PR #'.length));
        headline = parts[3];
        idsPart = parts[4];
      } else if (parts.length === 4) {
        date = parts[0];
        planKey = parts[1];
        headline = parts[2];
        idsPart = parts[3];
      } else {
        return;
      }

      const ids =
        idsPart === '' || idsPart === '-' || idsPart === '–' || idsPart === '—'
          ? []
          : idsPart
              .split(',')
              .map((id) => id.trim())
              .filter((id) => id !== '');

      rows.push({ date, planKey, prNumber, headline, ids, line: index + 1 });
    });

  return rows;
}

/**
 * Parses a plan's `## Retrospective compliance` section: the `Brief run:` line and the
 * `ID | Kind | Disposition | Where` table that follows it. Other tables in the plan are
 * ignored; a missing section or missing/incorrect header is reported as an error.
 */
export function parsePlanCompliance(text: string): ComplianceTable | ParseError[] {
  const lines = normalize(text).split('\n');
  const errors: ParseError[] = [];
  const rows: ComplianceRow[] = [];

  const headingIndex = lines.findIndex((line) => COMPLIANCE_HEADING_RE.test(line.trim()));
  if (headingIndex === -1) {
    return [error(1, 'missing section "## Retrospective compliance"')];
  }

  const nextHeading = lines.findIndex(
    (line, index) => index > headingIndex && /^##\s/.test(line.trim()),
  );
  const body = lines.slice(headingIndex + 1, nextHeading === -1 ? lines.length : nextHeading);
  const lineNumberAt = (offset: number): number => headingIndex + offset + 2;

  let briefRun: string | null = null;
  let header: string[] | null = null;
  let headerLine = headingIndex + 1;
  const dataRows: Array<{ cells: string[]; line: number }> = [];

  body.forEach((raw, offset) => {
    const lineNumber = lineNumberAt(offset);
    const line = raw.trim();
    if (line === '') return;

    const briefMatch = /^Brief run:\s*(.+)$/.exec(line);
    if (briefMatch) {
      if (briefRun === null) {
        briefRun = briefMatch[1].trim();
      } else {
        errors.push(error(lineNumber, 'duplicate Brief run: line'));
      }
      return;
    }

    if (!line.startsWith('|')) return;

    const cells = splitRow(line);
    if (cells.length > 0 && cells.every((cell) => SEPARATOR_CELL_RE.test(cell))) return;

    if (header === null) {
      header = cells.map((cell) => cell.toLowerCase());
      headerLine = lineNumber;
      return;
    }

    dataRows.push({ cells, line: lineNumber });
  });

  if (header === null) {
    errors.push(
      error(headingIndex + 1, 'missing compliance table header (ID | Kind | Disposition | Where)'),
    );
    return errors;
  }

  const headerCells = header;
  const missingColumns = COMPLIANCE_COLUMNS.filter((name) => !headerCells.includes(name));
  if (missingColumns.length > 0) {
    errors.push(
      error(
        headerLine,
        `compliance table is missing column(s) ${missingColumns.join(
          ', ',
        )} (expected ID | Kind | Disposition | Where)`,
      ),
    );
    return errors;
  }

  const value = (cells: string[], name: string): string => {
    const at = headerCells.indexOf(name);
    return at === -1 ? '' : (cells[at] ?? '');
  };

  for (const dataRow of dataRows) {
    const { cells, line: lineNumber } = dataRow;

    const id = value(cells, 'id');
    if (id === '') {
      errors.push(error(lineNumber, 'missing ID'));
      continue;
    }

    const kind = value(cells, 'kind');
    if (kind !== 'practice' && kind !== 'action') {
      errors.push(error(lineNumber, `${id}: unknown kind "${kind}"`));
      continue;
    }

    const dispositionCell = value(cells, 'disposition');
    const dispositionMatch = /^(applied|deferred)\s*(?:[–—-]\s*(.+))?$/.exec(dispositionCell);
    if (!dispositionMatch) {
      errors.push(error(lineNumber, `${id}: unknown disposition "${dispositionCell}"`));
      continue;
    }

    const where = value(cells, 'where');
    if (where === '') errors.push(error(lineNumber, `${id}: missing where`));

    const row: ComplianceRow = {
      id,
      kind,
      disposition: dispositionMatch[1] as ComplianceRow['disposition'],
      where,
    };
    if (dispositionMatch[2] !== undefined) row.reason = dispositionMatch[2].trim();
    rows.push(row);
  }

  return errors.length > 0 ? errors : { briefRun, rows };
}

/** `<date> · <planKey> · [PR #<n> · ]<headline> · <ids|->`, IDs deduped and sorted. */
export function formatIndexRow(entry: Entry): string {
  const ids = Array.from(
    new Set(
      entry.sections.flatMap((section) =>
        section.bullets
          .map((bullet) => bullet.disposition.id)
          .filter((id): id is string => id !== undefined),
      ),
    ),
  ).sort();

  const parts = [entry.date, entry.planKey];
  if (entry.prNumber !== null) parts.push(`PR #${entry.prNumber}`);
  parts.push(entry.headline);
  parts.push(ids.length > 0 ? ids.join(', ') : '-');
  return parts.join(' · ');
}

/** `YYYY-MM-DD` prefix of the file's basename, or `null`. Handles `/` and `\` separators. */
export function planDateFromFile(path: string): string | null {
  const basename = normalize(path).split(/[\\/]/).pop() ?? '';
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(basename);
  return match === null ? null : match[1];
}

function isBlank(line: string): boolean {
  return line.trim() === '';
}

function isParseErrorItem(value: unknown): value is ParseError {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { line?: unknown; message?: unknown };
  return typeof candidate.line === 'number' && typeof candidate.message === 'string';
}

function error(line: number, message: string): ParseError {
  return { line, message: `line ${line}: ${message}` };
}

function isMetricsLine(line: string): boolean {
  return line === METRICS_NOT_RECORDED || METRICS_RE.test(line);
}

function parseBullet(line: string, lineNumber: number, errors: ParseError[]): Bullet | null {
  const content = line.replace(/^-\s*/, '');
  const parts = content.split('→');
  const tagCount = parts.length - 1;
  const text = (parts[0] ?? '').trim();

  if (tagCount === 0) {
    errors.push(
      error(
        lineNumber,
        `bullet has no disposition tag (→ RP-nnn, → RA-nnn, or → context-only): ${text}`,
      ),
    );
    return null;
  }

  if (tagCount > 1) {
    errors.push(
      error(lineNumber, `bullet has ${tagCount} disposition tags, expected exactly 1: ${content}`),
    );
    return null;
  }

  const tag = (parts[1] ?? '').trim();
  if (tag === 'context-only') return { text, disposition: { contextOnly: true } };
  if (TAG_RE.test(tag)) return { text, disposition: { id: tag, contextOnly: false } };

  errors.push(error(lineNumber, `malformed disposition tag: ${tag}`));
  return null;
}

function splitRow(line: string): string[] {
  const cells = line.split('|').map((cell) => cell.trim());
  if (cells.length > 0 && cells[0] === '') cells.shift();
  if (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();
  return cells;
}
