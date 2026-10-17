import { RemoteRegistryService } from './remote-registry.service';
import { RemoteModuleEntry, RemoteModuleNotFoundError } from './remote-registry.types';

function fakeRegistryFetcher(entries: RemoteModuleEntry[]) {
  return jest.fn().mockResolvedValue(entries);
}

function fakeLoader() {
  return jest.fn().mockResolvedValue({ loaded: true });
}

describe('RemoteRegistryService', () => {
  it('resolves a registered module', async () => {
    const service = new RemoteRegistryService(
      fakeRegistryFetcher([
        {
          projectId: 'tinyurl',
          moduleName: 'card',
          version: '1.0.0',
          remoteEntry: 'https://example/tinyurl/remoteEntry.js',
        },
      ]),
      fakeLoader(),
    );
    const ref = await service.resolveModule('tinyurl', 'card');
    expect(ref.entry.remoteEntry).toBe('https://example/tinyurl/remoteEntry.js');
  });

  it('rejects with RemoteModuleNotFoundError when the module is not registered', async () => {
    const service = new RemoteRegistryService(fakeRegistryFetcher([]), fakeLoader());
    await expect(service.resolveModule('tinyurl', 'card')).rejects.toBeInstanceOf(
      RemoteModuleNotFoundError,
    );
  });

  it('delegates load to the injected module loader', async () => {
    const loader = fakeLoader();
    const entry: RemoteModuleEntry = {
      projectId: 'tinyurl',
      moduleName: 'card',
      version: '1.0.0',
      remoteEntry: 'https://example/tinyurl/remoteEntry.js',
    };
    const service = new RemoteRegistryService(fakeRegistryFetcher([entry]), loader);

    const ref = await service.resolveModule('tinyurl', 'card');
    await ref.load();

    expect(loader).toHaveBeenCalledWith(entry);
  });
});
