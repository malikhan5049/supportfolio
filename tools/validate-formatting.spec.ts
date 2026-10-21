import { execSync } from 'child_process';
import * as fs from 'fs';
import * as yaml from 'js-yaml';

describe('formatting gate', () => {
  it('passes prettier --check on the gated file globs', () => {
    execSync(
      'npx prettier --check "platform/**/*.{ts,html}" "tools/**/*.ts" "projects/**/*.{ts,html}" "eslint.config.mjs" "jest.config.ts" "jest.preset.js"',
      { stdio: 'inherit' },
    );
  });

  it('check-formatting.yml is valid YAML with push, pull_request triggers and a check-formatting job', () => {
    const doc: any = yaml.load(fs.readFileSync('.github/workflows/check-formatting.yml', 'utf8'));
    expect(doc.on.push).toBeDefined();
    expect(doc.on.pull_request).toBeDefined();
    expect(doc.jobs['check-formatting']).toBeDefined();
  });
});
