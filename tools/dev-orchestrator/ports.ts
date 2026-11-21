import * as net from 'net';
import { join } from 'path';
import { loadPlatformManifest, type PlatformManifest, type ProjectManifest } from './manifests';

export interface PortConflict {
  port: number;
  owner: string;
}

export function collectPlannedPorts(
  order: string[],
  manifests: ProjectManifest[],
  platform: PlatformManifest,
): number[] {
  const servicesById = new Map(platform.platformServices.map((service) => [service.id, service]));
  const projectsById = new Map(manifests.map((manifest) => [manifest.id, manifest]));
  const ports: number[] = [];

  for (const id of order) {
    const service = servicesById.get(id);
    if (service?.port !== undefined) {
      ports.push(service.port);
    }
    if (service?.managementPort !== undefined) {
      ports.push(service.managementPort);
    }

    const local = projectsById.get(id)?.local;
    if (local?.service) {
      ports.push(local.service.port);
      if (local.service.managementPort !== undefined) {
        ports.push(local.service.managementPort);
      }
    }
    if (local?.frontend) {
      ports.push(local.frontend.devPort);
    }
  }

  return ports;
}

export function findPortConflicts(
  planned: number[],
  platform: PlatformManifest = loadPlatformManifest(
    join(__dirname, '..', '..', 'platform', 'project.manifest.yaml'),
  ),
): PortConflict[] {
  const ownerByPort = new Map(platform.reservedPorts.map((entry) => [entry.port, entry.owner]));
  const seen = new Set<number>();
  const reported = new Set<number>();
  const conflicts: PortConflict[] = [];

  for (const port of planned) {
    if (!seen.has(port)) {
      seen.add(port);
      continue;
    }
    if (reported.has(port)) {
      continue;
    }
    reported.add(port);
    conflicts.push({ port, owner: ownerByPort.get(port) ?? 'plan' });
  }

  return conflicts;
}

function isPortBusy(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (error: NodeJS.ErrnoException) => {
      resolve(error.code === 'EADDRINUSE');
    });
    server.once('listening', () => {
      server.close(() => resolve(false));
    });
    server.listen(port);
  });
}

export async function checkPortsFree(ports: number[]): Promise<{ port: number; busy: true }[]> {
  const busyPorts: { port: number; busy: true }[] = [];

  for (const port of ports) {
    if (await isPortBusy(port)) {
      busyPorts.push({ port, busy: true });
    }
  }

  return busyPorts;
}
