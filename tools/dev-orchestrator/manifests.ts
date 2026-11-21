import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { load as loadYaml } from 'js-yaml';
import { validateAllManifests } from '../validate-all-manifests';

export interface LocalService {
  gradleModule: string;
  port: number;
  managementPort?: number;
  healthPath?: string;
  envFile?: string;
}

export interface LocalFrontend {
  nxProject: string;
  devPort: number;
  devRemoteEntry: string;
  standaloneBuild?: string;
}

export interface LocalSection {
  service?: LocalService;
  frontend?: LocalFrontend;
  dependsOn: string[];
  databases?: string[];
}

export interface ExposedModule {
  name: string;
  version: string;
  remoteEntry: string;
}

export interface ProjectManifest {
  id: string;
  displayName: string;
  shortDescription?: string;
  features?: string[];
  openUrl?: string;
  exposedModules?: ExposedModule[];
  local?: LocalSection;
}

export interface PlatformService {
  id: string;
  kind: 'compose' | 'compose-profile' | 'gradle';
  gradleModule?: string;
  port?: number;
  managementPort?: number;
  healthPath?: string;
  composeFile?: string;
  serviceName?: string;
  profile?: string;
}

export interface PlatformManifest {
  id: string;
  displayName: string;
  platformServices: PlatformService[];
  reservedPorts: { port: number; owner: string }[];
  surface?: { local: LocalSection };
}

const MANIFEST_FILE = 'project.manifest.yaml';

export function loadProjectManifests(root: string): ProjectManifest[] {
  const projectsDir = join(root, 'projects');
  const manifestPaths = readdirSync(projectsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(projectsDir, entry.name, MANIFEST_FILE))
    .filter((manifestPath) => existsSync(manifestPath));

  const invalid = validateAllManifests(projectsDir).filter((result) => !result.valid);
  if (invalid.length > 0) {
    throw new Error(
      `invalid project manifest(s): ${manifestPaths.join(', ')}: ${JSON.stringify(invalid)}`,
    );
  }

  return manifestPaths.map(
    (manifestPath) => loadYaml(readFileSync(manifestPath, 'utf8')) as ProjectManifest,
  );
}

export function loadPlatformManifest(path: string): PlatformManifest {
  const manifest = loadYaml(readFileSync(path, 'utf8')) as PlatformManifest | undefined;
  if (!manifest?.platformServices) {
    throw new Error('platform manifest missing platformServices');
  }
  return manifest;
}

export function shellAppFromManifest(platform: PlatformManifest): ProjectManifest {
  if (!platform.surface?.local) {
    throw new Error('platform manifest has no surface.local');
  }
  return {
    id: 'shell',
    displayName: platform.displayName,
    local: platform.surface.local,
  };
}
