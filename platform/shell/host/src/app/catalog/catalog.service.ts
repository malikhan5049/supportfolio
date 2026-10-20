import { HttpClient } from '@angular/common/http';
import { InjectionToken, Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { toRemoteProject } from './remote-registry.providers';
import type { RemoteProjectDto, RemoteProject } from './registry.types';

export const CATALOG_REGISTRY_URL = new InjectionToken<string>('CATALOG_REGISTRY_URL', {
  factory: () => environment.registryUrl,
});

export class RegistryUnavailableError extends Error {
  override readonly name = 'RegistryUnavailableError';
}

/** Reads the runtime remote registry and hands the catalog page its projects. */
@Injectable()
export class CatalogService {
  private readonly http = inject(HttpClient);
  private readonly registryUrl = inject(CATALOG_REGISTRY_URL);

  async loadProjects(): Promise<RemoteProject[]> {
    const envelope = await new Promise<{ projects: RemoteProjectDto[] }>((resolve, reject) => {
      this.http
        .get<{ projects: RemoteProjectDto[] }>(this.registryUrl)
        .subscribe({ next: resolve, error: reject });
    }).catch(() => {
      throw new RegistryUnavailableError('The remote registry cannot be read right now');
    });
    return envelope.projects.map(toRemoteProject);
  }
}
