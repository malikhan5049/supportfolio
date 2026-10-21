/**
 * Mirrors harness workflows byte-for-byte at the repo root (.github/workflows/) — GitHub only
 * registers reusable workflows at the top level. Canonical files live under
 * platform/harness/workflows/ (platform spec layout); these mirrors are generated output.
 *
 * After editing a harness workflow: npx tsx tools/sync-harness-workflows.ts, commit both files.
 * validate-workflows.spec.ts fails on drift, so never edit the mirrors directly.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const CANONICAL = 'platform/harness/workflows';
const MIRROR = '.github/workflows';

const files = ['backend-ci.yml', 'frontend-ci.yml', 'deploy.yml'];

fs.mkdirSync(MIRROR, { recursive: true });

for (const name of files) {
  const source = path.join(CANONICAL, name);
  if (!fs.existsSync(source)) {
    console.error(`Missing canonical harness workflow: ${source}`);
    process.exit(1);
  }
  const bytes = fs.readFileSync(source);
  fs.writeFileSync(path.join(MIRROR, name), bytes);
  console.log(`mirrored ${name}`);
}
