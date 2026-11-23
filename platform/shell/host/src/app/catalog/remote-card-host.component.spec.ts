import { Component, EventEmitter, Input, Output } from '@angular/core';
import { fireEvent, render, screen } from '@testing-library/angular';
import { RemoteCardHostComponent } from './remote-card-host.component';
import { RemoteRegistryService } from 'shared-ui-lib';
import type { RemoteModuleRef } from 'shared-ui-lib';
import type { RemoteProject } from './registry.types';

class FakeRemoteCard {
  title = '';
  description = '';
  features: string[] = [];
  openUrl = '';
  open = new EventEmitter<void>();
}

@Component({
  selector: 'app-openable-fake-remote-card',
  standalone: true,
  template: '<button type="button" data-testid="fake-open" (click)="open.emit()">Open</button>',
})
class OpenableFakeRemoteCard {
  @Input() title = '';
  @Input() description = '';
  @Input() features: string[] = [];
  @Input() openUrl = '';
  @Output() open = new EventEmitter<void>();
}

const project = (): RemoteProject => ({
  id: 'identity',
  displayName: 'Identity',
  shortDescription: 'SSO and JWT issuance.',
  features: ['GitHub sign-in'],
  openUrl: 'http://localhost:8081',
  exposedModules: [
    {
      projectId: 'identity',
      moduleName: 'card',
      version: '1.0.0',
      remoteEntry: 'http://localhost:4301/remoteEntry.js',
    },
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

const fakeRegistryRecording = (
  component: unknown,
): { requested: string[]; registry: RemoteRegistryService } => {
  const requested: string[] = [];
  return {
    requested,
    registry: {
      resolveModule: (_projectId: unknown, moduleName: string) => {
        requested.push(moduleName);
        return Promise.resolve({
          entry: project().exposedModules[0],
          load: () => Promise.resolve(component),
        }) as Promise<RemoteModuleRef>;
      },
    } as unknown as RemoteRegistryService,
  };
};

describe('RemoteCardHostComponent', () => {
  it('renders the remote component with registry metadata when loading succeeds', async () => {
    const { fixture } = await render(RemoteCardHostComponent, {
      inputs: { project: project() },
      providers: [
        { provide: RemoteRegistryService, useValue: fakeRegistryResolving(FakeRemoteCard) },
      ],
    });
    await fixture.whenStable();
    expect(
      fixture.nativeElement.querySelector('[data-testid="remote-card-identity"]'),
    ).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Identity');
  });

  it('renders the offline tile when the remote cannot be loaded', async () => {
    const { fixture } = await render(RemoteCardHostComponent, {
      inputs: { project: project() },
      providers: [
        { provide: RemoteRegistryService, useValue: fakeRegistryRejecting(new Error('boom')) },
      ],
    });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[data-testid="remote-card-offline"]')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Identity');
    expect(fixture.nativeElement.textContent).toContain('Offline');
    expect(screen.queryByTestId('open-action')).toBeNull();
  });

  it('resolves the module named card, not the first exposed module', async () => {
    const multi = {
      ...project(),
      exposedModules: [
        {
          projectId: 'identity',
          moduleName: 'admin',
          version: '1.0.0',
          remoteEntry: 'http://localhost:4301/remoteEntry.js',
        },
        {
          projectId: 'identity',
          moduleName: 'card',
          version: '1.0.0',
          remoteEntry: 'http://localhost:4301/remoteEntry.js',
        },
      ],
    };
    const { requested, registry } = fakeRegistryRecording(FakeRemoteCard);
    const { fixture } = await render(RemoteCardHostComponent, {
      inputs: { project: multi },
      providers: [{ provide: RemoteRegistryService, useValue: registry }],
    });
    await fixture.whenStable();
    expect(requested).toEqual(['card']);
  });

  it('opens the project url in a new tab from the remote card action', async () => {
    const openSpy = jest.spyOn(window, 'open').mockReturnValue(null);
    const { fixture } = await render(RemoteCardHostComponent, {
      inputs: { project: project() },
      providers: [
        { provide: RemoteRegistryService, useValue: fakeRegistryResolving(OpenableFakeRemoteCard) },
      ],
    });
    await fixture.whenStable();
    fireEvent.click(screen.getByTestId('fake-open'));
    await fixture.whenStable();
    expect(openSpy).toHaveBeenCalledWith('http://localhost:8081', '_blank', 'noopener,noreferrer');
    openSpy.mockRestore();
  });
});
