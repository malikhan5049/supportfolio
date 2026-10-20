import { HttpClient } from '@angular/common/http';
import type { Provider, Type } from '@angular/core';
import type { RemoteModuleEntry, RemoteCardComponent } from 'shared-ui-lib';
import { RemoteRegistryService } from 'shared-ui-lib';
import { loadFederatedCard } from './federated-loader';
import type { RemoteProjectDto } from './registry.types';
import type { RemoteProject } from './registry.types';

/** Maps one wire DTO onto the app-level project with fully-qualified module entries. */
export function toRemoteProject(dto: RemoteProjectDto): RemoteProject {
  return {
    id: dto.id,
    displayName: dto.displayName,
    shortDescription: dto.shortDescription,
    features: dto.features,
    openUrl: dto.openUrl,
    exposedModules: dto.exposedModules.map((module) => ({
      projectId: dto.id,
      moduleName: module.name,
      version: module.version,
      remoteEntry: module.remoteEntry,
    })),
  };
}

/** Flattens projects into the module entries the RemoteRegistryService consumes. */
export function toRemoteModuleEntries(projects: RemoteProject[]): RemoteModuleEntry[] {
  return projects.flatMap((project) => project.exposedModules);
}

type RegistryEnvelope = { projects: RemoteProjectDto[] };

/**
 * Builds the RemoteRegistryService the shell consumes: the fetcher pulls the runtime registry
 * same-origin, and the loader resolves `./card` into a component type.
 */
export function provideRemoteRegistry(registryUrl: string): Provider[] {
  return [
    {
      provide: RemoteRegistryService,
      useFactory: (http: HttpClient): RemoteRegistryService =>
        new RemoteRegistryService(
          async () => {
            const envelope = await new Promise<RegistryEnvelope>((resolve, reject) => {
              http.get<RegistryEnvelope>(registryUrl).subscribe({ next: resolve, error: reject });
            });
            return toRemoteModuleEntries(envelope.projects.map(toRemoteProject));
          },
          (entry: RemoteModuleEntry) => loadFederatedCard(entry) as Promise<unknown>,
        ),
      deps: [HttpClient],
    },
  ];
}
