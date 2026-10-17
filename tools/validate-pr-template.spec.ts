import * as fs from 'fs';
import { validateTemplate } from './validate-templates';

describe('pull_request_template.md', () => {
  it('matches the pr-checklist template sections', () => {
    const result = validateTemplate('pr-checklist', fs.readFileSync('.github/pull_request_template.md', 'utf8'));
    expect(result.valid).toBe(true);
  });
});
