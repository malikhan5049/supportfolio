import * as fs from 'fs';

describe('tinyurl activation and deploy-readiness docs', () => {
  it('documents the tinyurl required checks and the manual environment activation', () => {
    const activation = fs.readFileSync('platform/harness/ACTIVATION.md', 'utf8');
    for (const check of [
      'tinyurl-backend',
      'tinyurl-frontend',
      'tinyurl-image',
      'tinyurl-k3s-manifests',
      'tinyurl-arm-smoke',
      'tinyurl-prod-login',
    ])
      expect(activation).toContain(check);
    expect(activation).toMatch(/environment protection/i);
    expect(activation).toContain('CD_ENABLED');
  });

  it('states that the deploy manifests are reviewed but not deployed here', () => {
    const readme = fs.readFileSync('projects/tinyurl/deploy/README.md', 'utf8');
    expect(readme).toMatch(/not deployed|no real cluster|successor/i);
    expect(readme).toContain('postgres-secret.yaml.template');
  });

  it('documents the successor registry/origin work now that the fixture is gone', () => {
    const readme = fs.readFileSync('projects/tinyurl/README.md', 'utf8');
    expect(readme).toContain('4201');
    const activation = fs.readFileSync('platform/harness/ACTIVATION.md', 'utf8');
    expect(activation).toMatch(/GHCR|package visibility/i);
  });
});
