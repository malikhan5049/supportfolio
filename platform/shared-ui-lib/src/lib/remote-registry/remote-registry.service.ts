import {
  RemoteModuleEntry,
  RemoteModuleRef,
  RemoteModuleNotFoundError,
} from './remote-registry.types';

export class RemoteRegistryService {
  constructor(
    private registryFetcher: () => Promise<RemoteModuleEntry[]>,
    private moduleLoader: (entry: RemoteModuleEntry) => Promise<unknown>,
  ) {}

  async resolveModule(projectId: string, moduleName: string): Promise<RemoteModuleRef> {
    const entries = await this.registryFetcher();
    const entry = entries.find((e) => e.projectId === projectId && e.moduleName === moduleName);

    if (!entry) {
      throw new RemoteModuleNotFoundError(projectId, moduleName);
    }

    return {
      entry,
      load: () => this.moduleLoader(entry),
    };
  }
}
