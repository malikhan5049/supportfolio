import { execSync } from 'child_process';
import * as fs from 'fs';

describe('lint baseline', () => {
  it('root eslint config resolves without error', () => {
    expect(() => execSync('npx eslint --print-config eslint.config.mjs')).not.toThrow();
  });

  it('prettier formats a deliberately misformatted fixture to match the committed expectation', () => {
    const unformatted = fs.readFileSync('tools/fixtures/unformatted.ts', 'utf8');
    const formatted = execSync('npx prettier --config .prettierrc.json --parser typescript', {
      input: unformatted,
    }).toString();
    expect(formatted).toBe(fs.readFileSync('tools/fixtures/formatted-expected.ts', 'utf8'));
  });
});
