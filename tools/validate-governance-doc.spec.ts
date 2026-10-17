import * as fs from 'fs';

describe('GOVERNANCE.md', () => {
  it('contains the required top-level sections', () => {
    const text = fs.readFileSync('platform/harness/GOVERNANCE.md', 'utf8');
    for (const heading of ['## Human Gates', '## Guardrails', '## Policies']) {
      expect(text).toContain(heading);
    }
  });
});
