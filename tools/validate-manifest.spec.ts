import { readFileSync } from 'fs';
import { resolve } from 'path';
import { validateManifest } from './validate-manifest';

function readFixture(name: string): string {
  return readFileSync(resolve(__dirname, 'fixtures', name), 'utf8');
}

describe('validateManifest', () => {
  it('accepts a manifest exposing a card module', () => {
    const result = validateManifest(readFixture('valid-manifest.yaml'));
    expect(result.valid).toBe(true);
  });

  it('rejects a manifest missing the card exposed module', () => {
    const result = validateManifest(readFixture('invalid-manifest.yaml'));
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/card/i);
  });
});
