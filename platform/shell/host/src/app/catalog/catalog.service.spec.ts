import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CatalogService, RegistryUnavailableError, CATALOG_REGISTRY_URL } from './catalog.service';
import type { RemoteProjectDto } from './registry.types';

const dto = (): RemoteProjectDto => ({
  id: 'identity',
  displayName: 'Identity',
  shortDescription: 'SSO.',
  features: ['GitHub sign-in'],
  openUrl: 'http://localhost:8081',
  exposedModules: [
    { name: 'card', version: '1.0.0', remoteEntry: 'http://localhost:4301/remoteEntry.js' },
  ],
});

describe('CatalogService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CATALOG_REGISTRY_URL, useValue: '/api/remote-registry' },
        CatalogService,
      ],
    });
  });

  it('loads and normalizes one project per registry entry', async () => {
    const service = TestBed.inject(CatalogService);
    const http = TestBed.inject(HttpTestingController);
    const promise = service.loadProjects();
    http.expectOne('/api/remote-registry').flush({ projects: [dto()] });
    const projects = await promise;
    expect(projects.length).toBe(1);
    expect(projects[0].id).toBe('identity');
    expect(projects[0].exposedModules[0].projectId).toBe('identity');
  });

  it('surfaces a typed error when the registry endpoint fails', async () => {
    const service = TestBed.inject(CatalogService);
    const http = TestBed.inject(HttpTestingController);
    const promise = service.loadProjects();
    http
      .expectOne('/api/remote-registry')
      .flush({ error: 'registry_unavailable' }, { status: 503, statusText: 'Unavailable' });
    await expect(promise).rejects.toBeInstanceOf(RegistryUnavailableError);
  });
});
