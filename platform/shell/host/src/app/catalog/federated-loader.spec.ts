import { loadRemoteModule } from '@angular-architects/module-federation';
import { loadFederatedCard } from './federated-loader';
import type { RemoteModuleEntry } from 'shared-ui-lib';

jest.mock('@angular-architects/module-federation', () => ({
  loadRemoteModule: jest.fn(),
}));

class FakeCard {}

const entry = (overrides: Partial<RemoteModuleEntry> = {}): RemoteModuleEntry => ({
  projectId: 'identity',
  moduleName: 'card',
  version: '1.0.0',
  remoteEntry: 'http://localhost:4301/remoteEntry.js',
  ...overrides,
});

describe('loadFederatedCard', () => {
  beforeEach(() => {
    (loadRemoteModule as jest.Mock).mockReset();
  });

  it('loads a module by explicit remoteEntry, never by build-time name alone', async () => {
    (loadRemoteModule as jest.Mock).mockResolvedValue({ default: FakeCard });
    await expect(loadFederatedCard(entry())).resolves.toBe(FakeCard);
    expect(loadRemoteModule).toHaveBeenCalledWith({
      remoteEntry: 'http://localhost:4301/remoteEntry.js',
      remoteName: 'identity',
      exposedModule: './card',
    });
  });

  it('fails with a typed error when a remote omits the card default export', async () => {
    (loadRemoteModule as jest.Mock).mockResolvedValue({});
    await expect(loadFederatedCard(entry())).rejects.toThrow('./card');
  });

  it('propagates remote load failures', async () => {
    (loadRemoteModule as jest.Mock).mockRejectedValue(new Error('down'));
    await expect(loadFederatedCard(entry())).rejects.toThrow('down');
  });
});
