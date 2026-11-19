import * as fs from 'fs';

describe('tinyurl activation docs', () => {
  it('documents the tinyurl required checks and the manual environment activation', () => {
    const activation = fs.readFileSync('platform/harness/ACTIVATION.md', 'utf8');
    for (const check of [
      'tinyurl-backend',
      'tinyurl-frontend',
      'tinyurl-image',
      'demo-stack',
      'tinyurl-prod-login',
    ])
      expect(activation).toContain(check);
    expect(activation).toContain('CD_ENABLED');
  });

  it('documents the demo stack path that replaced the old orchestration deployment surface', () => {
    const readme = fs.readFileSync('projects/tinyurl/README.md', 'utf8');
    expect(readme).toContain('/apps/tinyurl');
  });
});
