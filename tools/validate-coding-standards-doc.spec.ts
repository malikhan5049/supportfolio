import * as fs from 'fs';

describe('CODING_STANDARDS.md', () => {
  it('contains the required sections', () => {
    const text = fs.readFileSync('platform/harness/CODING_STANDARDS.md', 'utf8');
    for (const heading of [
      '## Backend (Java/Spring)',
      '## Frontend (Angular)',
      '## API Design',
      '## Logging',
      '## Testing',
      '## Commits',
    ]) {
      expect(text).toContain(heading);
    }
  });
});
