import { render, screen } from '@testing-library/angular';
import { RemoteCardHostComponent } from './remote-card-host.component';
import { RemoteRegistryService, CardComponent } from 'shared-ui-lib';
import type { RemoteModuleRef } from 'shared-ui-lib';
import type { RemoteProject } from './registry.types';

class FakeRemoteCard {
  title = '';
  description = '';
  features: string[] = [];
  openUrl = '';
  ngOnInit(): void {}
}

const project = (): RemoteProject => ({
  id: 'identity',
  displayName: 'Identity',
  shortDescription: 'SSO and JWT issuance.',
  features: ['GitHub sign-in'],
  openUrl: 'http://localhost:8081',
  exposedModules: [
    { projectId: 'identity', moduleName: 'card', version: '1.0.0', remoteEntry: 'http://localhost:4301/remoteEntry.js' },
  ],
});

const fakeRegistryResolving = (component: unknown): RemoteRegistryService =>
  ({
    resolveModule: () =>
      Promise.resolve({
        entry: project().exposedModules[0],
        load: () => Promise.resolve(component),
      }) as Promise<RemoteModuleRef>,
  }) as unknown as RemoteRegistryService;

const fakeRegistryRejecting = (error: Error): RemoteRegistryService =>
  ({
    resolveModule: () => Promise.reject(error),
  }) as unknown as RemoteRegistryService;

describe('RemoteCardHostComponent', () => {
  it('renders the remote component with registry metadata when loading succeeds', async () => {
    const { fixture } = await render(RemoteCardHostComponent, {
      inputs: { project: project() },
      providers: [{ provide: RemoteRegistryService, useValue: fakeRegistryResolving(FakeRemoteCard) }],
    });
    await fixture.whenStable();
    expect(
      fixture.nativeElement.querySelector('[data-testid="remote-card-identity"]'),
    ).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Identity');
  });

  it('falls back to the shared card when the remote cannot be loaded', async () => {
    const { fixture } = await render(RemoteCardHostComponent, {
      inputs: { project: project() },
      providers: [
        { provide: RemoteRegistryService, useValue: fakeRegistryRejecting(new Error('boom')) },
      ],
    });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Identity');
    expect(screen.getByTestId('open-action')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid^="remote-card-"]')).toBeNull();
  });
});
