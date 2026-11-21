import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { resolveOrder } from './closure';
import {
  LocalFrontend,
  LocalSection,
  PlatformManifest,
  PlatformService,
  ProjectManifest,
  shellAppFromManifest,
} from './manifests';
import { trustedOriginsFor } from './registry';

export type PlanMode = 'serve' | 'build-watch';

export interface ProcessSpec {
  name: string;
  color: string;
  command: string;
}

export interface ResolvedPlan {
  processes: ProcessSpec[];
  env: Record<string, string>;
  registryPath: string;
}

/** Host app: its local section lives in the platform manifest's `surface.local`, not in a project. */
const SPA_APP_ID = 'shell';
/** Nx emits `dist/<project root>`; the host's root is the platform surface app. */
const SPA_PROJECT_ROOT = ['platform', 'shell', 'host'];
const DOCKER_PROJECT = 'supportfolio-dev';
const DATABASE_ID = 'postgres';
const DEFAULT_DATABASE_PORT = 5432;
/** Compose files overlaid for profile services (telemetry observes the dev stack). */
const PROFILE_COMPOSE_FILES = ['docker-compose.demo.yml', 'docker-compose.dev.yml'];
const PROFILE_SERVICE_NAMES = ['prometheus', 'grafana'];
const WAIT_ON_TIMEOUT_MS = 120000;
const REGISTRY_PATH = ['platform', 'shell', 'config', 'remote-registry.dev.json'];
const IDENTITY_PRIVATE_KEY_FILE = ['platform', 'identity', 'dev-key.pem'];

const PLATFORM_SERVICE_COLORS: Record<string, string> = {
  postgres: 'gray',
  telemetry: 'cyan',
  identity: 'green',
  shell: 'blue',
};
const PROJECT_SERVICE_COLOR = 'magenta';
const FRONTEND_COLOR = 'yellow';
const DEFAULT_SERVICE_COLOR = 'white';

/** Nx writes every project build to `dist/<project root>`; project frontends follow the slice layout. */
function frontendOutputPath(app: ProjectManifest): string[] {
  return app.id === SPA_APP_ID ? SPA_PROJECT_ROOT : ['projects', app.id, 'microfrontend'];
}

function parseEnvFile(path: string): Record<string, string> {
  const env: Record<string, string> = {};
  if (!existsSync(path)) {
    return env;
  }

  for (const rawLine of readFileSync(path, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) {
      continue;
    }

    const separator = line.indexOf('=');
    if (separator <= 0) {
      continue;
    }

    env[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }

  return env;
}

function gradleCommand(service: { gradleModule?: string }, id: string): string {
  if (!service.gradleModule) {
    throw new Error(`gradle service "${id}" has no gradleModule`);
  }
  return `gradlew.bat :${service.gradleModule}:bootRun --console=plain`;
}

function composeCommand(service: PlatformService, id: string): string {
  if (!service.composeFile || !service.serviceName) {
    throw new Error(`compose service "${id}" needs composeFile and serviceName`);
  }
  return `docker compose -p ${DOCKER_PROJECT} -f ${service.composeFile} up -d --wait ${service.serviceName}`;
}

function composeProfileCommand(service: PlatformService, id: string): string {
  if (!service.profile) {
    throw new Error(`compose-profile service "${id}" needs a profile`);
  }
  const files = PROFILE_COMPOSE_FILES.map((file) => `-f ${file}`).join(' ');
  return `docker compose -p ${DOCKER_PROJECT} ${files} --profile ${service.profile} up -d --wait --no-deps ${PROFILE_SERVICE_NAMES.join(' ')}`;
}

function serviceCommand(service: PlatformService, id: string): string {
  switch (service.kind) {
    case 'gradle':
      return gradleCommand(service, id);
    case 'compose':
      return composeCommand(service, id);
    case 'compose-profile':
      return composeProfileCommand(service, id);
  }
}

function frontendCommand(frontend: LocalFrontend, mode: PlanMode): string {
  return mode === 'serve'
    ? `npx nx serve ${frontend.nxProject}`
    : `npx nx build ${frontend.nxProject} --watch`;
}

function healthUrlOf(
  id: string,
  platformService: PlatformService | undefined,
  local: LocalSection | undefined,
): string | undefined {
  const healthPath = platformService?.healthPath ?? local?.service?.healthPath;
  // Actuator answers on the management port only: the public port serves the application.
  const port =
    platformService !== undefined
      ? (platformService.managementPort ?? platformService.port)
      : (local?.service?.managementPort ?? local?.service?.port);

  if (!healthPath || port === undefined) {
    return undefined;
  }
  return `http-get://localhost:${port}${healthPath}`;
}

export function buildProcessPlan(
  mode: PlanMode,
  app: ProjectManifest,
  manifests: ProjectManifest[],
  platform: PlatformManifest,
  repoRoot: string,
): ResolvedPlan {
  const order = resolveOrder(app.id, manifests, platform);
  const platformServiceById = new Map(
    platform.platformServices.map((service) => [service.id, service]),
  );

  // The host app's local section is lifted from the platform manifest; never hardcode its shape.
  const localOf = (id: string): LocalSection | undefined =>
    manifests.find((manifest) => manifest.id === id)?.local ??
    (id === app.id ? platform.surface?.local : undefined);

  const databasePort = platformServiceById.get(DATABASE_ID)?.port ?? DEFAULT_DATABASE_PORT;

  const waitOnFor = (id: string): string => {
    const dependencies = order.slice(0, order.indexOf(id));
    const urls = dependencies
      .map((dependencyId) =>
        healthUrlOf(dependencyId, platformServiceById.get(dependencyId), localOf(dependencyId)),
      )
      .filter((url): url is string => url !== undefined);

    if (dependencies.includes(DATABASE_ID)) {
      urls.push(`tcp:127.0.0.1:${databasePort}`);
    }

    return urls.length === 0 ? '' : `wait-on -t ${WAIT_ON_TIMEOUT_MS} ${urls.join(' ')} && `;
  };

  const processes: ProcessSpec[] = [];
  for (const id of order) {
    const platformService = platformServiceById.get(id);
    if (platformService) {
      processes.push({
        name: platformService.id,
        color: PLATFORM_SERVICE_COLORS[platformService.id] ?? DEFAULT_SERVICE_COLOR,
        // Containers come up in dependency order on their own; only Spring services wait on health.
        command:
          platformService.kind === 'gradle'
            ? `${waitOnFor(id)}${serviceCommand(platformService, id)}`
            : serviceCommand(platformService, id),
      });
    } else {
      const projectService = localOf(id)?.service;
      if (!projectService) {
        throw new Error(`no local service definition for "${id}"`);
      }
      processes.push({
        name: id === SPA_APP_ID ? id : `${id}-service`,
        color: PROJECT_SERVICE_COLOR,
        command: `${waitOnFor(id)}${gradleCommand(projectService, id)}`,
      });
    }

    const frontend = localOf(id)?.frontend;
    if (frontend) {
      processes.push({
        name: frontend.nxProject,
        color: FRONTEND_COLOR,
        command: frontendCommand(frontend, mode),
      });
    }
  }

  // The host app's frontend origin must stay in the CSP list even when the caller omits its manifest.
  const originsSource =
    platform.surface?.local && !manifests.some((manifest) => manifest.id === SPA_APP_ID)
      ? [...manifests, shellAppFromManifest(platform)]
      : manifests;

  const registryPath = join(repoRoot, ...REGISTRY_PATH);
  const env: Record<string, string> = {
    ...parseEnvFile(join(repoRoot, '.env')),
    SUPPORTFOLIO_IDENTITY_JWT_PRIVATE_KEY_FILE: join(repoRoot, ...IDENTITY_PRIVATE_KEY_FILE),
    SPRING_DEVTOOLS_LIVERELOAD_ENABLED: 'false',
    SUPPORTFOLIO_SHELL_REMOTE_REGISTRY_FILE: registryPath,
    SUPPORTFOLIO_SHELL_TRUSTED_REMOTE_ORIGINS: trustedOriginsFor(originsSource),
  };

  if (mode === 'build-watch') {
    const staticLocations = join(repoRoot, 'dist', ...frontendOutputPath(app), '');
    env.SPRING_WEB_RESOURCES_STATIC_LOCATIONS = `file:${staticLocations}`;
  }

  return { processes, env, registryPath };
}
