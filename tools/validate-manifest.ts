import { readFileSync } from 'fs';
import { resolve } from 'path';
import Ajv2020 from 'ajv/dist/2020';
import { load } from 'js-yaml';

export interface ManifestValidationResult {
  valid: boolean;
  errors: string[];
}

const ajv = new Ajv2020({ allErrors: true });
const schemaPath = resolve(
  __dirname,
  '../platform/harness/manifest-schema/project.manifest.schema.json',
);
const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
const validate = ajv.compile(schema);

export function validateManifest(manifestYaml: string): ManifestValidationResult {
  let manifest: unknown;
  try {
    manifest = load(manifestYaml);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { valid: false, errors: [`Invalid YAML: ${message}`] };
  }

  const valid = validate(manifest);

  if (!valid) {
    const errors =
      validate.errors?.map((err) => {
        const path = err.instancePath || '/';
        const detail =
          err.keyword === 'const' && err.params && 'allowedValue' in err.params
            ? `must be ${JSON.stringify(err.params.allowedValue)}`
            : err.message;
        return `${path}: ${detail}`;
      }) ?? [];
    return { valid: false, errors };
  }

  return { valid: true, errors: [] };
}
