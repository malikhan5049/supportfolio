import { globSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { validateManifest, type ManifestValidationResult } from './validate-manifest';

interface ManifestValidation {
  filePath: string;
  result: ManifestValidationResult;
}

function validateManifests(projectsDir: string): ManifestValidation[] {
  const manifestFiles = globSync('**/project.manifest.yaml', {
    cwd: resolve(projectsDir),
  });

  return manifestFiles.map((file) => {
    const filePath = resolve(projectsDir, file);
    try {
      const content = readFileSync(filePath, 'utf8');
      return { filePath, result: validateManifest(content) };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        filePath,
        result: { valid: false, errors: [`Failed to read ${filePath}: ${message}`] },
      };
    }
  });
}

export function validateAllManifests(projectsDir: string): ManifestValidationResult[] {
  return validateManifests(projectsDir).map((validation) => validation.result);
}

export function main(argv: string[]): number {
  const projectsDir = argv.find((arg) => !arg.startsWith('-')) ?? 'projects';
  const failOnInvalid = argv.includes('--fail-on-invalid');

  const validations = validateManifests(projectsDir);
  const invalid = validations.filter((validation) => !validation.result.valid);

  if (invalid.length > 0) {
    if (failOnInvalid) {
      console.error(`${invalid.length} manifest(s) failed validation:`);
      for (const validation of invalid) {
        const normalizedPath = validation.filePath.replace(/\\/g, '/');
        console.error(`  ${normalizedPath}`);
        for (const error of validation.result.errors) {
          console.error(`    - ${error}`);
        }
      }
      return 1;
    }

    console.log(
      `${invalid.length} invalid manifest(s) found (not failing because --fail-on-invalid was not set).`
    );
    return 0;
  }

  console.log(`Validated ${validations.length} manifest(s). All valid.`);
  return 0;
}

if (require.main === module) {
  process.exit(main(process.argv.slice(2)));
}
