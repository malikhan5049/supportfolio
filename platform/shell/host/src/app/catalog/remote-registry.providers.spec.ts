import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { loadRemoteModule } from '@angular-architects/module-federation';
import { provideRemoteRegistry, toRemoteProject } from './remote-registry.providers';
import { RemoteRegistryService } from 'shared-ui-lib';
import type { RemoteProjectDto } from './registry.types';

jest.mock('@angular-architects/module-federation', () => ({
  loadRemoteModule: jest.fn(),
}));

class FakeCard {}

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

describe('remote-registry providers', () => {
  beforeEach(() => {
    (loadRemoteModule as jest.Mock).mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ...provideRemoteRegistry('/api/remote-registry'),
      ],
    });
  });

  it('maps registry projects onto flat module entries', () => {
    const project = toRemoteProject(dto());
    expect(project.exposedModules[0]).toEqual({
      projectId: 'identity',
      moduleName: 'card',
      version: '1.0.0',
      remoteEntry: 'http://localhost:4301/remoteEntry.js',
    });
  });

  it('resolves a module and loads the federated component type', async () => {
    (loadRemoteModule as jest.Mock).mockResolvedValue({ default: FakeCard });
    const http = TestBed.inject(HttpTestingController);
    const service = TestBed.inject(RemoteRegistryService);
    const promise = service.resolveModule('identity', 'card');
    http.expectOne('/api/remote-registry').flush({ projects: [dto()] });
    const ref = await promise;
    expect(ref.entry.projectId).toBe('identity');
    expect(ref.entry.moduleName).toBe('card');
    await expect(ref.load()).resolves.toBe(FakeCard);
  });
});
