import { render } from '@testing-library/angular';
import { CatalogPageComponent } from './catalog-page.component';
import { CatalogService } from './catalog.service';
import { RemoteRegistryService } from 'shared-ui-lib';
import type { RemoteProject } from './registry.types';

const project = (id: string): RemoteProject => ({
  id,
  displayName: id === 'identity' ? 'Identity' : 'TinyURL',
  shortDescription: 'SSO.',
  features: ['GitHub sign-in'],
  openUrl: 'http://localhost:8081',
  exposedModules: [
    {
      projectId: id,
      moduleName: 'card',
      version: '1.0.0',
      remoteEntry: 'http://localhost:4301/remoteEntry.js',
    },
  ],
});

const failingCatalog = {
  loadProjects: () => Promise.reject(new Error('registry down')),
} as unknown as CatalogService;

const loadingCatalog = (projects: RemoteProject[]) =>
  ({
    loadProjects: () => Promise.resolve(projects),
  }) as unknown as CatalogService;

describe('CatalogPageComponent', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('renders one card per registry project', async () => {
    const { fixture } = await render(CatalogPageComponent, {
      providers: [
        {
          provide: CatalogService,
          useValue: loadingCatalog([project('identity'), project('tinyurl')]),
        },
        { provide: RemoteRegistryService, useValue: undefined },
      ],
    });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('[data-testid^="project-card-"]').length).toBe(2);
  });

  it('shows a registry error state instead of an empty grid', async () => {
    const { fixture } = await render(CatalogPageComponent, {
      providers: [{ provide: CatalogService, useValue: failingCatalog }],
    });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[data-testid="registry-error"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('[data-testid^="project-card-"]').length).toBe(0);
  });
});
