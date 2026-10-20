/** The wire shape of the gateway's `GET /api/remote-registry` response. */
export interface RemoteProjectDto {
  id: string;
  displayName: string;
  shortDescription: string;
  features: string[];
  openUrl: string;
  exposedModules: { name: string; version: string; remoteEntry: string }[];
}

/** One registry project as the catalog app consumes it (module entries are fully qualified). */
export interface RemoteProject {
  id: string;
  displayName: string;
  shortDescription: string;
  features: string[];
  openUrl: string;
  exposedModules: {
    projectId: string;
    moduleName: string;
    version: string;
    remoteEntry: string;
  }[];
}

