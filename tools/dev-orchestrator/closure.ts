import type { LocalSection, PlatformManifest, ProjectManifest } from './manifests';

/** The host app lives in the platform manifest's `surface.local`, not in a project manifest. */
const SURFACE_LOCAL_APP_ID = 'shell';

export function resolveOrder(
  appId: string,
  manifests: ProjectManifest[],
  platform: PlatformManifest,
): string[] {
  const projectsById = new Map(manifests.map((manifest) => [manifest.id, manifest]));
  const platformIds = new Set(platform.platformServices.map((service) => service.id));

  const order: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const path: string[] = [];

  const localOf = (id: string): LocalSection | undefined => {
    const projectLocal = projectsById.get(id)?.local;
    if (projectLocal) {
      return projectLocal;
    }

    if (id === SURFACE_LOCAL_APP_ID) {
      return platform.surface?.local;
    }

    return undefined;
  };

  const isKnown = (id: string) => localOf(id) !== undefined || platformIds.has(id);

  const dependenciesOf = (id: string): string[] => {
    const local = localOf(id);
    return local ? [...local.dependsOn, ...(local.databases ?? [])] : [];
  };

  const visit = (id: string): void => {
    if (visited.has(id)) {
      return;
    }

    if (visiting.has(id)) {
      const cycle = [...path.slice(path.indexOf(id)), id];
      throw new Error(`dependency cycle: ${cycle.join(' -> ')}`);
    }

    visiting.add(id);
    path.push(id);

    for (const dependency of dependenciesOf(id)) {
      if (!isKnown(dependency)) {
        throw new Error(`manifest "${id}" depends on unknown id "${dependency}"`);
      }
      visit(dependency);
    }

    path.pop();
    visiting.delete(id);
    visited.add(id);
    order.push(id);
  };

  if (!isKnown(appId)) {
    throw new Error(`unknown app id "${appId}"`);
  }

  visit(appId);
  return order;
}
