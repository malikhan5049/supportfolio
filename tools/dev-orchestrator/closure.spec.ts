import { resolveOrder } from './closure';
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
  local: { dependsOn: ['identity', 'tinyurl', 'telemetry'] },
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
      'postgres',
      'tinyurl',
      'telemetry',
      'shell',
    ]);
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
