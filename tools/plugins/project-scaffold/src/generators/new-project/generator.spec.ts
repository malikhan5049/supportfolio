import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import newProjectGenerator from './generator';
import { validateManifest } from '../../../../../validate-manifest';

describe('newProjectGenerator', () => {
  it('creates a manifest, service stub, and microfrontend stub under projects/<name>', async () => {
    const tree = createTreeWithEmptyWorkspace();
    await newProjectGenerator(tree, { name: 'tinyurl', displayName: 'TinyURL', shortDescription: 'Shorten a URL' });
    expect(tree.exists('projects/tinyurl/project.manifest.yaml')).toBe(true);
    expect(tree.exists('projects/tinyurl/service/build.gradle.kts')).toBe(true);
    expect(tree.exists('projects/tinyurl/microfrontend/project.json')).toBe(true);
  });

  it('fails without writing any file when the project already exists', async () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write('projects/tinyurl/project.manifest.yaml', 'id: tinyurl');
    await expect(newProjectGenerator(tree, { name: 'tinyurl', displayName: 'TinyURL', shortDescription: 'x' }))
      .rejects.toThrow(/already exists/i);
    expect(tree.read('projects/tinyurl/project.manifest.yaml', 'utf8')).toBe('id: tinyurl');
    expect(tree.exists('projects/tinyurl/service/build.gradle.kts')).toBe(false);
    expect(tree.exists('projects/tinyurl/microfrontend/project.json')).toBe(false);
  });

  it('generates a manifest that passes schema validation', async () => {
    const tree = createTreeWithEmptyWorkspace();
    await newProjectGenerator(tree, { name: 'tinyurl', displayName: 'TinyURL', shortDescription: 'Shorten a URL' });
    const manifest = tree.read('projects/tinyurl/project.manifest.yaml', 'utf8');
    const result = validateManifest(manifest);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});
