export interface RemoteModuleEntry {
  projectId: string;
  moduleName: string;
  version: string;
  remoteEntry: string;
}

export interface RemoteModuleRef {
  entry: RemoteModuleEntry;
  load: () => Promise<unknown>;
}

export class RemoteModuleNotFoundError extends Error {
  constructor(projectId: string, moduleName: string) {
    super(`No exposed module "${moduleName}" registered for project "${projectId}"`);
  }
}
