import assert from 'node:assert';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { assertNoDevIdentityUrl, findDevIdentityUrl } from './prod-bundle-gate';

describe('prod-bundle-gate', () => {
  let dir: string;
  let nested: string;

  beforeAll(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'prod-bundle-gate-'));
    nested = path.join(dir, 'browser', 'chunk');
    mkdirSync(nested, { recursive: true });
  });

  afterAll(() => rmSync(dir, { recursive: true }));

  it('rejects a production bundle containing the dev identity url', () => {
    writeFileSync(path.join(dir, 'main.js'), 'const u="http://localhost:8081";');
    assert.deepEqual(findDevIdentityUrl(dir), ['main.js']);
    writeFileSync(path.join(nested, 'chunk.js'), 'fetch("http://localhost:8081/api/token")');
    expect(() => assertNoDevIdentityUrl(dir)).toThrow(/localhost:8081/);
  });

  it('accepts a clean production bundle', () => {
    rmSync(path.join(dir, 'main.js'));
    rmSync(path.join(nested, 'chunk.js'));
    writeFileSync(path.join(dir, 'main.js'), 'const u="";');
    expect(() => assertNoDevIdentityUrl(dir)).not.toThrow();
  });

  it('names the offending files in the error', () => {
    writeFileSync(path.join(dir, 'bad.js'), 'export const base = "http://localhost:8081";');
    expect(() => assertNoDevIdentityUrl(dir)).toThrow(/bad\.js/);
  });
});
