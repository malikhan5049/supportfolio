import { ManifestValidationResult } from './validate-manifest';

export type TemplateName = 'spec' | 'design' | 'plan' | 'pr-checklist';

export const REQUIRED_SECTIONS: Record<TemplateName, string[]> = {
  spec: [
    '## Intent',
    '## Goals',
    '## Non-Goals',
    '## Anti-Goals',
    '## Acceptance Criteria',
    '## Constraints',
  ],
  design: [
    '## Intent and Why',
    '## Goals',
    '## Non-Goals',
    '## Anti-Goals',
    '## Constraints',
    '## Decided Architecture',
    "## What's Left to the Builder",
  ],
  plan: [
    '## Global Constraints',
    '## Review Focus',
    '## Tasks',
    '## Self-Review Notes',
  ],
  'pr-checklist': [
    '## What Changed',
    '## Traces To',
    '## Tests Added',
    '## Security Checklist',
    '## Rollback Plan',
  ],
};

export function validateTemplate(
  templateName: TemplateName,
  contents: string
): ManifestValidationResult {
  const required = REQUIRED_SECTIONS[templateName];
  if (!required) {
    return {
      valid: false,
      errors: [`Unknown template name: ${templateName}`],
    };
  }

  const errors: string[] = [];
  for (const heading of required) {
    if (!contents.includes(heading)) {
      errors.push(`Missing required section: ${heading}`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, errors: [] };
}
