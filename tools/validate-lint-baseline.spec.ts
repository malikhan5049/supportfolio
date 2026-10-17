import { execSync } from 'child_process';
import * as fs from 'fs';

describe('lint baseline', () => {
  it('root eslint config resolves without error', () => {
    expect(() => execSync('npx eslint --print-config eslint.config.mjs')).not.toThrow();
  });

  it('prettier formats a deliberately misformatted fixture to match the committed expectation', () => {
    const formatted = execSync(
      'npx prettier --config .prettierrc.json tools/fixtures/unformatted.ts'
    ).toString();
    expect(formatted).toBe(fs.readFileSync('tools/fixtures/formatted-expected.ts', 'utf8'));
  });
});
