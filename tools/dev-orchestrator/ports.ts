import * as net from 'net';
import { localSectionFor, type PlatformManifest, type ProjectManifest } from './manifests';

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
  const ports: number[] = [];

  for (const id of order) {
    const service = servicesById.get(id);
    if (service?.port !== undefined) {
      ports.push(service.port);
    }
    if (service?.managementPort !== undefined) {
      ports.push(service.managementPort);
    }

    // Same lift as the plan builder: the host app's local section lives on the platform manifest.
    const local = localSectionFor(id, manifests, platform);
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

export function findPortConflicts(planned: number[], platform: PlatformManifest): PortConflict[] {
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

/**
 * A listener may bind a single stack: `nx serve` takes `[::1]` only, Docker publishes on IPv4.
 * Probing both loopback stacks is the only reliable preflight on a dual-stack machine.
 */
const PROBE_HOSTS = ['127.0.0.1', '::1'];
const PROBE_TIMEOUT_MS = 300;

function canConnect(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    let settled = false;
    const settle = (busy: boolean): void => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      resolve(busy);
    };

    socket.setTimeout(PROBE_TIMEOUT_MS, () => settle(false));
    socket.once('connect', () => settle(true));
    socket.once('error', () => settle(false));
  });
}

async function isPortBusy(port: number): Promise<boolean> {
  for (const host of PROBE_HOSTS) {
    if (await canConnect(host, port)) {
      return true;
    }
  }

  return false;
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
