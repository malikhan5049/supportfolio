import { localSectionFor } from './manifests';
import type { LocalSection, PlatformManifest, ProjectManifest } from './manifests';

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

  const localOf = (id: string): LocalSection | undefined =>
    localSectionFor(id, manifests, platform);

  // A project manifest without a `local` section is still a known id: it simply runs nothing.
  const isKnown = (id: string) =>
    projectsById.has(id) || localOf(id) !== undefined || platformIds.has(id);

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
