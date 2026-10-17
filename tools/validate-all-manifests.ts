import { globSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { validateManifest, type ManifestValidationResult } from './validate-manifest';

export function validateAllManifests(projectsDir: string): ManifestValidationResult[] {
  const manifestFiles = globSync('**/project.manifest.yaml', {
    cwd: resolve(projectsDir),
  });

  return manifestFiles.map((file) => {
    const filePath = resolve(projectsDir, file);
    try {
      const content = readFileSync(filePath, 'utf8');
      return validateManifest(content);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { valid: false, errors: [`Failed to read ${filePath}: ${message}`] };
    }
  });
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const projectsDir = args.find((arg) => !arg.startsWith('-')) ?? 'projects';
  const failOnInvalid = args.includes('--fail-on-invalid');

  const results = validateAllManifests(projectsDir);
  const invalidResults = results.filter((result) => !result.valid);

  if (failOnInvalid && invalidResults.length > 0) {
    console.error(`${invalidResults.length} manifest(s) failed validation.`);
    process.exit(1);
  }

  console.log(`Validated ${results.length} manifest(s). All valid.`);
  process.exit(0);
}
