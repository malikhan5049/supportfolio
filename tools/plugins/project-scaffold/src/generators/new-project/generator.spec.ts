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

  it('appends the service project include to the root settings.gradle.kts while preserving existing content', async () => {
    const tree = createTreeWithEmptyWorkspace();
    const initialSettings = `rootProject.name = "supportfolio"

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        mavenCentral()
    }
}

includeBuild("build-logic")

include("platform:shared-spring-starter")
`;
    tree.write('settings.gradle.kts', initialSettings);
    await newProjectGenerator(tree, { name: 'tinyurl', displayName: 'TinyURL', shortDescription: 'Shorten a URL' });
    const updated = tree.read('settings.gradle.kts', 'utf8');
    expect(updated).toContain('include("projects:tinyurl:service")');
    expect(updated).toContain('include("platform:shared-spring-starter")');
    expect(updated).toContain('includeBuild("build-logic")');
    expect(updated).toContain('rootProject.name = "supportfolio"');
  });

  it('creates root settings.gradle.kts with the project include when it does not exist', async () => {
    const tree = createTreeWithEmptyWorkspace();
    await newProjectGenerator(tree, { name: 'tinyurl', displayName: 'TinyURL', shortDescription: 'Shorten a URL' });
    const created = tree.read('settings.gradle.kts', 'utf8');
    expect(created).toContain('rootProject.name = "supportfolio"');
    expect(created).toContain('include("projects:tinyurl:service")');
  });
});
