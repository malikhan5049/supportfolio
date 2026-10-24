/**
 * Spec gate: the TinyURL production bundle must not contain the dev Identity URL
 * (`localhost:8081`). Production login is same-origin through the service's own proxy
 * (`''` in environment.prod.ts), so any hit means a dev value leaked into the bundle.
 *
 * CLI: npx tsx tools/prod-bundle-gate.ts dist/projects/tinyurl/microfrontend (exit 1 on a hit)
 */
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';

const DEV_IDENTITY_URL = 'localhost:8081';

export function findDevIdentityUrl(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findDevIdentityUrl(full));
    } else if (fs.readFileSync(full, 'utf8').includes(DEV_IDENTITY_URL)) {
      results.push(path.relative(dir, full));
    }
  }
  return results;
}

export function assertNoDevIdentityUrl(dir: string): void {
  const offenders = findDevIdentityUrl(dir);
  assert.ok(
    offenders.length === 0,
    `The production bundle contains the dev Identity URL "localhost:8081" in: ${offenders.join(', ')}`,
  );
}

if (require.main === module) {
  const dir = process.argv[2];
  if (!dir) {
    console.error('usage: npx tsx tools/prod-bundle-gate.ts <dist-dir>');
    process.exit(2);
  }
  try {
    assertNoDevIdentityUrl(dir);
    console.log(`prod-bundle-gate: clean (${dir})`);
  } catch (error) {
    console.error(getMessage(error));
    process.exit(1);
  }
}

function getMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
