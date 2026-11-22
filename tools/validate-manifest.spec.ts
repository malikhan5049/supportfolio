import { readFileSync } from 'fs';
import { resolve } from 'path';
import { validateAllManifests } from './validate-all-manifests';
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

  it('returns a validation result for malformed YAML instead of throwing', () => {
    const result = validateManifest('not: [valid yaml');
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/yaml/i);
  });
});

describe('local section', () => {
  it('accepts a manifest with a local recipe (valid-manifest-local.yaml)', () => {
    const result = validateManifest(readFixture('valid-manifest-local.yaml'));
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects a typo inside local (invalid-manifest-local-typo.yaml)', () => {
    const result = validateManifest(readFixture('invalid-manifest-local-typo.yaml'));
    expect(result.valid).toBe(false);
    // `dependOn` (one `s` short) is rejected as an unknown key and `dependsOn` is reported missing.
    // Ajv's message text is "must NOT have additional properties" and the formatter only emits the
    // instance path, so the typo is pinned through the required-property error naming `dependsOn`.
    const errors = result.errors.join('\n');
    expect(errors).toContain('/local: must NOT have additional properties');
    expect(errors).toContain("must have required property 'dependsOn'");
  });

  it('validates the real tinyurl manifest with its local block', () => {
    const result = validateAllManifests(resolve(__dirname, '..', 'projects'))[0];
    expect(result.valid).toBe(true);
  });
});
