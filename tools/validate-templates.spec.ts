import * as fs from 'fs';
import { REQUIRED_SECTIONS, validateTemplate } from './validate-templates';

describe('validateTemplate', () => {
  it('passes spec.template.md, which contains every required spec section', () => {
    const result = validateTemplate('spec', fs.readFileSync('platform/harness/templates/spec.template.md', 'utf8'));
    expect(result.valid).toBe(true);
  });

  it('fails a spec missing an Acceptance Criteria section', () => {
    const result = validateTemplate('spec', '## Intent\n## Goals\n## Non-Goals\n## Anti-Goals\n## Constraints');
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/Acceptance Criteria/i);
  });

  it('passes design.template.md, which contains every required design section', () => {
    const result = validateTemplate('design', fs.readFileSync('platform/harness/templates/design.template.md', 'utf8'));
    expect(result.valid).toBe(true);
  });

  it('passes plan.template.md, which contains every required plan section', () => {
    const result = validateTemplate('plan', fs.readFileSync('platform/harness/templates/plan.template.md', 'utf8'));
    expect(result.valid).toBe(true);
  });

  it('passes pr-checklist.template.md, which contains every required PR checklist section', () => {
    const result = validateTemplate('pr-checklist', fs.readFileSync('platform/harness/templates/pr-checklist.template.md', 'utf8'));
    expect(result.valid).toBe(true);
  });

  it('fails an unknown template name', () => {
    const result = validateTemplate('unknown' as any, '# Hello');
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/unknown/i);
  });
});

describe('REQUIRED_SECTIONS', () => {
  it('defines required sections for every template name', () => {
    expect(REQUIRED_SECTIONS.spec).toEqual([
      '## Intent',
      '## Goals',
      '## Non-Goals',
      '## Anti-Goals',
      '## Acceptance Criteria',
      '## Constraints',
    ]);
    expect(REQUIRED_SECTIONS.design).toEqual([
      '## Intent and Why',
      '## Goals',
      '## Non-Goals',
      '## Anti-Goals',
      '## Constraints',
      '## Decided Architecture',
      "## What's Left to the Builder",
    ]);
    expect(REQUIRED_SECTIONS.plan).toEqual([
      '## Global Constraints',
      '## Review Focus',
      '## Tasks',
      '## Self-Review Notes',
    ]);
    expect(REQUIRED_SECTIONS['pr-checklist']).toEqual([
      '## What Changed',
      '## Traces To',
      '## Tests Added',
      '## Security Checklist',
      '## Rollback Plan',
    ]);
  });
});
