import * as fs from 'fs';

describe('tinyurl activation docs', () => {
  it('documents the tinyurl required checks and the manual environment activation', () => {
    const activation = fs.readFileSync('platform/harness/ACTIVATION.md', 'utf8');
    for (const check of ['tinyurl-backend', 'tinyurl-frontend', 'tinyurl-image', 'demo-stack'])
      expect(activation).toContain(check);
    // `tinyurl-prod-login` is gone from tools/branch-protection.ts, so the docs must not list it.
    expect(activation).not.toContain('tinyurl-prod-login');
    // The CD switch is retired: pin the negation so a re-added requirement fails this gate.
    expect(activation).toContain('`CD_ENABLED` variable no longer exists');
  });

  it('documents the demo stack path that replaced the old orchestration deployment surface', () => {
    const readme = fs.readFileSync('projects/tinyurl/README.md', 'utf8');
    expect(readme).toContain('/apps/tinyurl');
  });
});
