import { join } from 'path';
import { resolveOrder } from './closure';
import { loadPlatformManifest, loadProjectManifests } from './manifests';
import type { PlatformManifest, ProjectManifest } from './manifests';

const platform: PlatformManifest = {
  id: 'platform',
  displayName: 'Supportfolio platform',
  platformServices: [
    { id: 'postgres', kind: 'compose' },
    { id: 'identity', kind: 'gradle' },
    { id: 'shell', kind: 'gradle' },
    { id: 'telemetry', kind: 'compose-profile' },
  ],
  surface: {
    local: {
      frontend: {
        nxProject: 'shell-host',
        devPort: 4200,
        devRemoteEntry: 'http://localhost:4200/remoteEntry.js',
      },
      dependsOn: ['identity', 'telemetry'],
    },
  },
  reservedPorts: [],
};

const tinyurl: ProjectManifest = {
  id: 'tinyurl',
  displayName: 'TinyURL',
  local: { dependsOn: ['identity'], databases: ['postgres'] },
};

const shell: ProjectManifest = {
  id: 'shell',
  displayName: 'Supportfolio platform',
  local: { dependsOn: ['identity', 'telemetry'] },
};

const brokenUnknown: ProjectManifest = {
  id: 'tinyurl',
  displayName: 'TinyURL',
  local: { dependsOn: ['nope'] },
};

const cyclicA: ProjectManifest = {
  id: 'a',
  displayName: 'A',
  local: { dependsOn: ['b'] },
};

const cyclicB: ProjectManifest = {
  id: 'b',
  displayName: 'B',
  local: { dependsOn: ['a'] },
};

describe('resolveOrder', () => {
  it('orders a project after its platform and database dependencies', () => {
    expect(resolveOrder('tinyurl', [tinyurl], platform)).toEqual([
      'identity',
      'postgres',
      'tinyurl',
    ]);
  });

  it('orders the shell app last, after every dependency', () => {
    expect(resolveOrder('shell', [tinyurl, shell], platform)).toEqual([
      'identity',
      'telemetry',
      'shell',
    ]);
  });

  it('resolves shell dependencies from the platform surface when no shell manifest exists', () => {
    expect(resolveOrder('shell', [tinyurl], platform)).toEqual(['identity', 'telemetry', 'shell']);
  });

  it('resolves the real shell app from platform surface.local without a shell manifest', () => {
    const repoRoot = join(__dirname, '..', '..');
    const realPlatform = loadPlatformManifest(join(repoRoot, 'platform', 'project.manifest.yaml'));
    // loadProjectManifests(root)-style input: project manifests only, no shell manifest.
    const projects = loadProjectManifests(repoRoot).filter((manifest) => manifest.id !== 'shell');

    expect(resolveOrder('shell', projects, realPlatform)).toEqual([
      'identity',
      'telemetry',
      'shell',
    ]);
  });

  it('accepts a dependency whose manifest declares no local section', () => {
    const headless: ProjectManifest = { id: 'headless', displayName: 'Headless' };
    const dependent: ProjectManifest = {
      id: 'app',
      displayName: 'App',
      local: { dependsOn: ['headless'] },
    };

    expect(resolveOrder('app', [dependent, headless], platform)).toEqual(['headless', 'app']);
  });

  it('throws when the app id itself is unknown', () => {
    expect(() => resolveOrder('nope', [tinyurl], platform)).toThrow('unknown app id "nope"');
  });

  it('leaves unrelated platform services out of a project closure', () => {
    expect(resolveOrder('tinyurl', [tinyurl], platform)).not.toContain('telemetry');
  });

  it('emits each id exactly once', () => {
    const order = resolveOrder('shell', [tinyurl, shell], platform);
    expect(new Set(order).size).toBe(order.length);
  });

  it('throws when a dependency id is unknown', () => {
    expect(() => resolveOrder('tinyurl', [brokenUnknown], platform)).toThrow(
      'manifest "tinyurl" depends on unknown id "nope"',
    );
  });

  it('throws when dependencies form a cycle', () => {
    expect(() => resolveOrder('a', [cyclicA, cyclicB], platform)).toThrow(
      'dependency cycle: a -> b -> a',
    );
  });
});
