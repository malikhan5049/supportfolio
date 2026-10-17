import { validateAllManifests, main } from './validate-all-manifests';

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

describe('validate-all-manifests CLI output', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('prints the manifest path and errors when failing on invalid manifests', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const exitCode = main(['tools/fixtures/projects-with-one-invalid', '--fail-on-invalid']);

    expect(exitCode).toBe(1);
    const output = errorSpy.mock.calls.map(call => call.join(' ')).join('\n');
    expect(output).toMatch(/badproject[\\/]project\.manifest\.yaml/);
    expect(output).toContain('must be "card"');
  });

  it('does not print "All valid." when invalid manifests exist without --fail-on-invalid', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const exitCode = main(['tools/fixtures/projects-with-one-invalid']);

    expect(exitCode).toBe(0);
    expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining('All valid'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('1 invalid manifest(s)'));
  });

  it('prints "All valid." when no manifests are invalid', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const exitCode = main(['tools/fixtures/empty-projects-dir']);

    expect(exitCode).toBe(0);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('All valid'));
  });
});
