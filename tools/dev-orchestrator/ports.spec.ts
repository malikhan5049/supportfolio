import * as net from 'net';
import { checkPortsFree, collectPlannedPorts, findPortConflicts } from './ports';
import type { PlatformManifest, ProjectManifest } from './manifests';

const platform: PlatformManifest = {
  id: 'platform',
  displayName: 'Supportfolio platform',
  platformServices: [
    { id: 'postgres', kind: 'compose', port: 5432 },
    { id: 'identity', kind: 'gradle', port: 8081, managementPort: 9092 },
    { id: 'shell', kind: 'gradle', port: 8080, managementPort: 9091 },
    { id: 'telemetry', kind: 'compose-profile' },
  ],
  reservedPorts: [
    { port: 4200, owner: 'shell-host' },
    { port: 4201, owner: 'tinyurl-microfrontend' },
    { port: 8080, owner: 'shell' },
    { port: 8081, owner: 'identity' },
    { port: 8082, owner: 'tinyurl-service' },
    { port: 5432, owner: 'postgres' },
  ],
};

const tinyurl: ProjectManifest = {
  id: 'tinyurl',
  displayName: 'TinyURL',
  local: {
    service: { gradleModule: 'projects:tinyurl:service', port: 8082, managementPort: 9093 },
    frontend: {
      nxProject: 'tinyurl-microfrontend',
      devPort: 4201,
      devRemoteEntry: 'http://localhost:4201/remoteEntry.js',
    },
    dependsOn: ['identity'],
    databases: ['postgres'],
  },
};

const shell: ProjectManifest = {
  id: 'shell',
  displayName: 'Supportfolio platform',
  local: {
    frontend: {
      nxProject: 'shell-host',
      devPort: 4200,
      devRemoteEntry: 'http://localhost:4200/remoteEntry.js',
    },
    dependsOn: ['identity', 'tinyurl', 'telemetry'],
  },
};

describe('collectPlannedPorts', () => {
  it('collects platform and project ports in resolution order', () => {
    expect(
      collectPlannedPorts(
        ['identity', 'postgres', 'tinyurl', 'telemetry', 'shell'],
        [tinyurl, shell],
        platform,
      ),
    ).toEqual([8081, 9092, 5432, 8082, 9093, 4201, 8080, 9091, 4200]);
  });

  it('returns an empty list for an empty order', () => {
    expect(collectPlannedPorts([], [tinyurl, shell], platform)).toEqual([]);
  });

  it('skips ids with no declared ports', () => {
    expect(collectPlannedPorts(['telemetry'], [], platform)).toEqual([]);
  });
});

describe('findPortConflicts', () => {
  it('returns each duplicated port once with its reserved owner', () => {
    expect(findPortConflicts([8081, 8081])).toEqual([{ port: 8081, owner: 'identity' }]);
  });

  it('falls back to the plan owner for unreserved duplicates', () => {
    expect(findPortConflicts([4999, 5000, 4999])).toEqual([{ port: 4999, owner: 'plan' }]);
  });

  it('returns nothing when every port is unique', () => {
    expect(findPortConflicts([8081, 8082, 4200])).toEqual([]);
  });
});

describe('checkPortsFree', () => {
  it('reports a port that is already bound', async () => {
    const server = net.createServer();
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const busyPort = (server.address() as net.AddressInfo).port;

    try {
      await expect(checkPortsFree([busyPort])).resolves.toEqual([{ port: busyPort, busy: true }]);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('reports nothing when every port is free', async () => {
    const server = net.createServer();
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const freedPort = (server.address() as net.AddressInfo).port;
    await new Promise<void>((resolve) => server.close(() => resolve()));

    await expect(checkPortsFree([freedPort])).resolves.toEqual([]);
  });
});
