import * as fs from 'fs';
import { validateManifest } from './validate-manifest';

it('the tinyurl manifest is schema-valid and exposes card@1.0.0', () => {
  const manifest = fs.readFileSync('projects/tinyurl/project.manifest.yaml', 'utf8');
  expect(validateManifest(manifest).valid).toBe(true);
  expect(manifest).toContain('id: tinyurl');
  expect(manifest).toContain('name: card');
  expect(manifest).toContain('remoteEntry: http://localhost:4201/remoteEntry.js');
});
