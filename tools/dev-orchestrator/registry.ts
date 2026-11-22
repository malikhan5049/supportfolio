import { ExposedModule, ProjectManifest } from './manifests';

export interface DevRegistryEntry {
  id: string;
  displayName: string;
  shortDescription: string;
  features: string[];
  openUrl: string;
  exposedModules: ExposedModule[];
}

export interface DevRegistry {
  projects: DevRegistryEntry[];
}

const FALLBACK_MODULE_VERSION = '1.0.0';

function devRemoteEntryFor(manifest: ProjectManifest): string | undefined {
  return manifest.local?.frontend?.devRemoteEntry;
}

/**
 * A manifest that declares neither `openUrl` nor `exposedModules` still serves itself in dev: both
 * URLs are derived from the same `local.frontend` entry so the card can open and mount.
 */
function openUrlFor(manifest: ProjectManifest): string {
  if (manifest.openUrl !== undefined) {
    return manifest.openUrl;
  }

  const devPort = manifest.local?.frontend?.devPort;
  return devPort === undefined ? '' : `http://localhost:${devPort}`;
}

function exposedModulesFor(manifest: ProjectManifest): ExposedModule[] {
  if (manifest.exposedModules && manifest.exposedModules.length > 0) {
    return manifest.exposedModules.map((module) => ({
      name: module.name,
      version: module.version,
      remoteEntry: module.remoteEntry,
    }));
  }

  const remoteEntry = devRemoteEntryFor(manifest);
  if (!remoteEntry) {
    return [];
  }

  // Placeholder entry only: it keeps the card's remote entry populated, it is not a resolvable exposure.
  return [{ name: manifest.id, version: FALLBACK_MODULE_VERSION, remoteEntry }];
}

function toRegistryEntry(manifest: ProjectManifest): DevRegistryEntry {
  return {
    id: manifest.id,
    displayName: manifest.displayName,
    shortDescription: manifest.shortDescription ?? '',
    features: manifest.features ?? [],
    openUrl: openUrlFor(manifest),
    exposedModules: exposedModulesFor(manifest),
  };
}

export function generateDevRegistry(manifests: ProjectManifest[]): string {
  const registry: DevRegistry = {
    projects: [...manifests]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((manifest) => toRegistryEntry(manifest)),
  };

  return `${JSON.stringify(registry, null, 2)}\n`;
}

export function trustedOriginsFor(manifests: ProjectManifest[]): string {
  const origins = [...manifests]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((manifest) => manifest.local?.frontend?.devPort)
    .filter((devPort): devPort is number => devPort !== undefined)
    .map((devPort) => `http://localhost:${devPort}`);

  return [...new Set(origins)].join(',');
}
