import * as fs from 'fs';
import * as path from 'path';

describe('Identity card fixture', () => {
  const manifestPath = path.join('platform/shell/testing/identity-card/project.manifest.yaml');
  const mfConfigPath = path.join('platform/shell/testing/identity-card/webpack.config.js');

  it('the manifest validates', () => {
    const { validateManifest } = jest.requireActual<any>('./validate-manifest');
    const result = validateManifest(fs.readFileSync(manifestPath, 'utf8'));
    expect(result.valid).toBe(true);
  });

  it('declares the identity project with a card module', () => {
    const yaml = fs.readFileSync(manifestPath, 'utf8');
    expect(yaml).toContain('id: identity');
    expect(yaml).toContain('name: card');
  });

  it('the module federation config exposes ./card under the identity remote', () => {
    const config = fs.readFileSync(mfConfigPath, 'utf8');
    expect(config).toContain("name: 'identity'");
    expect(config).toContain("'./card'");
  });
});
