import { validateAllManifests } from './validate-all-manifests';

describe('validateAllManifests', () => {
  it('reports a failure for each invalid manifest found under projects/', () => {
    const results = validateAllManifests('tools/fixtures/projects-with-one-invalid');
    expect(results.some(r => !r.valid)).toBe(true);
  });

  it('returns no failures when no manifests exist', () => {
    const results = validateAllManifests('tools/fixtures/empty-projects-dir');
    expect(results).toEqual([]);
  });
});
