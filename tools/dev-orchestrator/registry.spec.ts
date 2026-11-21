import { readFileSync } from 'fs';
import { join } from 'path';
import { loadProjectManifests, ProjectManifest } from './manifests';
import { generateDevRegistry, trustedOriginsFor } from './registry';

const ROOT = join(__dirname, '..', '..');
const REGISTRY = join(ROOT, 'platform', 'shell', 'config', 'remote-registry.json');

const shell: ProjectManifest = {
  id: 'shell',
  displayName: 'Supportfolio',
  local: {
    frontend: {
      nxProject: 'shell-host',
      devPort: 4200,
      devRemoteEntry: 'http://localhost:4200/remoteEntry.js',
    },
    dependsOn: [],
  },
};

function tinyurlManifest(): ProjectManifest {
  const tinyurl = loadProjectManifests(ROOT).find((manifest) => manifest.id === 'tinyurl');
  if (!tinyurl) {
    throw new Error('projects/tinyurl/project.manifest.yaml is missing');
  }
  return tinyurl;
}

describe('generateDevRegistry', () => {
  it('produces byte-identical output for the same manifests', () => {
    expect(generateDevRegistry([shell, tinyurlManifest()])).toBe(
      generateDevRegistry([shell, tinyurlManifest()]),
    );
  });

  it('ends with a trailing newline', () => {
    expect(generateDevRegistry([shell, tinyurlManifest()]).endsWith('\n')).toBe(true);
  });

  it('mirrors the committed registry envelope and entry shape', () => {
    const parsed = JSON.parse(generateDevRegistry([shell, tinyurlManifest()]));
    const committed = JSON.parse(readFileSync(REGISTRY, 'utf8'));

    expect(Object.keys(parsed)).toEqual(Object.keys(committed));
    expect(Object.keys(parsed.projects[1])).toEqual(Object.keys(committed.projects[0]));
  });

  it('sorts projects by id regardless of manifest order', () => {
    const parsed = JSON.parse(generateDevRegistry([tinyurlManifest(), shell]));

    expect(parsed.projects.map((project: { id: string }) => project.id)).toEqual([
      'shell',
      'tinyurl',
    ]);
  });

  it('emits the full catalog DTO with dev URLs from the manifest', () => {
    const parsed = JSON.parse(generateDevRegistry([shell, tinyurlManifest()]));
    const tinyurl = parsed.projects[1];

    expect(tinyurl.id).toBe('tinyurl');
    expect(tinyurl.displayName).toBe('TinyURL');
    expect(tinyurl.shortDescription).toBe('Share short links and see how often they are used.');
    expect(tinyurl.features).toEqual([
      'Shorten any public URL',
      'Public link list with click counts',
      'Twenty shortens per user per hour',
    ]);
    expect(tinyurl.openUrl).toBe('http://localhost:4201');
    expect(tinyurl.exposedModules[0]).toEqual(
      expect.objectContaining({
        name: 'card',
        remoteEntry: 'http://localhost:4201/remoteEntry.js',
      }),
    );
  });

  it('falls back to the dev remote entry when a manifest exposes no module', () => {
    const parsed = JSON.parse(generateDevRegistry([shell, tinyurlManifest()]));

    expect(parsed.projects[0].exposedModules).toEqual([
      { name: 'shell', version: '1.0.0', remoteEntry: 'http://localhost:4200/remoteEntry.js' },
    ]);
  });
});

describe('trustedOriginsFor', () => {
  it('lists every dev origin once, in sorted id order', () => {
    expect(trustedOriginsFor([tinyurlManifest(), shell])).toBe(
      'http://localhost:4200,http://localhost:4201',
    );
  });

  it('skips manifests without a local frontend', () => {
    const headless: ProjectManifest = { id: 'identity', displayName: 'Identity' };

    expect(trustedOriginsFor([headless, shell])).toBe('http://localhost:4200');
  });
});
