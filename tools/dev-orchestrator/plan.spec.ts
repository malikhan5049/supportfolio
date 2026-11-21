import { isAbsolute, join } from 'path';
import { loadPlatformManifest, loadProjectManifests, shellAppFromManifest } from './manifests';
import { buildProcessPlan } from './plan';

const WORKSPACE_ROOT = join(__dirname, '..', '..');
/** Fake repo root: absolute on every platform, and has no `.env`, so the env map is pristine. */
const FAKE_REPO_ROOT = join(__dirname, 'fake-repo-root');

const platform = loadPlatformManifest(join(WORKSPACE_ROOT, 'platform', 'project.manifest.yaml'));
const manifests = loadProjectManifests(WORKSPACE_ROOT);
const shellApp = shellAppFromManifest(platform);

const tinyurl = manifests.find((manifest) => manifest.id === 'tinyurl');
if (!tinyurl) {
  throw new Error('tinyurl project manifest is missing');
}

const SHELL_NAMES = [
  'identity',
  'postgres',
  'tinyurl-service',
  'tinyurl-microfrontend',
  'telemetry',
  'shell',
  'shell-host',
];

const SHELL_SERVE_COMMANDS = [
  'gradlew.bat :platform:identity:bootRun --console=plain',
  'docker compose -p supportfolio-dev -f projects/tinyurl/docker-compose.yml up -d --wait postgres',
  'wait-on -t 120000 http-get://localhost:9092/actuator/health tcp:127.0.0.1:5432 && gradlew.bat :projects:tinyurl:service:bootRun --console=plain',
  'npx nx serve tinyurl-microfrontend',
  'docker compose -p supportfolio-dev -f docker-compose.demo.yml -f docker-compose.dev.yml --profile observability up -d --wait --no-deps prometheus grafana',
  'wait-on -t 120000 http-get://localhost:9092/actuator/health http-get://localhost:9093/actuator/health tcp:127.0.0.1:5432 && gradlew.bat :platform:shell:bootRun --console=plain',
  'npx nx serve shell-host',
];

const SHELL_COLORS = ['green', 'gray', 'magenta', 'yellow', 'cyan', 'blue', 'yellow'];

describe('buildProcessPlan', () => {
  describe('serve', () => {
    it('plans the shell app in dependency order with each frontend right after its service', () => {
      const plan = buildProcessPlan(
        'serve',
        shellApp,
        [tinyurl, shellApp],
        platform,
        FAKE_REPO_ROOT,
      );

      expect(plan.processes.map((process) => process.name)).toEqual(SHELL_NAMES);
      expect(plan.processes.map((process) => process.command)).toEqual(SHELL_SERVE_COMMANDS);
      expect(plan.processes.map((process) => process.color)).toEqual(SHELL_COLORS);
    });

    it('resolves the env map and registry path against the repo root', () => {
      const plan = buildProcessPlan(
        'serve',
        shellApp,
        [tinyurl, shellApp],
        platform,
        FAKE_REPO_ROOT,
      );

      expect(plan.env.SPRING_DEVTOOLS_LIVERELOAD_ENABLED).toBe('false');
      expect(plan.env.SPRING_WEB_RESOURCES_STATIC_LOCATIONS).toBeUndefined();
      expect(plan.registryPath).toBe(
        join(FAKE_REPO_ROOT, 'platform', 'shell', 'config', 'remote-registry.dev.json'),
      );
      expect(plan.env.SUPPORTFOLIO_SHELL_REMOTE_REGISTRY_FILE).toBe(plan.registryPath);
      expect(isAbsolute(plan.env.SUPPORTFOLIO_SHELL_REMOTE_REGISTRY_FILE)).toBe(true);
      expect(plan.env.SUPPORTFOLIO_IDENTITY_JWT_PRIVATE_KEY_FILE).toBe(
        join(FAKE_REPO_ROOT, 'platform', 'identity', 'dev-key.pem'),
      );
      expect(isAbsolute(plan.env.SUPPORTFOLIO_IDENTITY_JWT_PRIVATE_KEY_FILE)).toBe(true);
      expect(plan.env.SUPPORTFOLIO_SHELL_TRUSTED_REMOTE_ORIGINS).toBe(
        'http://localhost:4200,http://localhost:4201',
      );
    });

    it('plans only the requested project closure', () => {
      const plan = buildProcessPlan('serve', tinyurl, manifests, platform, FAKE_REPO_ROOT);

      expect(plan.processes.map((process) => process.name)).toEqual([
        'identity',
        'postgres',
        'tinyurl-service',
        'tinyurl-microfrontend',
      ]);
      expect(plan.processes).toHaveLength(4);
    });
  });

  describe('build-watch', () => {
    it('plans the shell app with watching frontends and the host static locations', () => {
      const plan = buildProcessPlan(
        'build-watch',
        shellApp,
        [tinyurl, shellApp],
        platform,
        FAKE_REPO_ROOT,
      );

      expect(plan.processes.map((process) => process.name)).toEqual(SHELL_NAMES);
      expect(
        plan.processes
          .filter((process) => process.color === 'yellow')
          .map((process) => process.command),
      ).toEqual(['npx nx build tinyurl-microfrontend --watch', 'npx nx build shell-host --watch']);

      const staticLocations = plan.env.SPRING_WEB_RESOURCES_STATIC_LOCATIONS;
      expect(staticLocations.startsWith('file:')).toBe(true);
      const staticLocationsPath = staticLocations.slice('file:'.length);
      expect(isAbsolute(staticLocationsPath)).toBe(true);
      expect(staticLocationsPath.endsWith(join('dist', 'platform', 'shell', 'host', ''))).toBe(
        true,
      );
    });

    it('points the watched project at its own dist output', () => {
      const plan = buildProcessPlan('build-watch', tinyurl, manifests, platform, FAKE_REPO_ROOT);

      const staticLocationsPath = plan.env.SPRING_WEB_RESOURCES_STATIC_LOCATIONS.slice(
        'file:'.length,
      );
      expect(isAbsolute(staticLocationsPath)).toBe(true);
      expect(
        staticLocationsPath.endsWith(join('dist', 'projects', 'tinyurl', 'microfrontend', '')),
      ).toBe(true);
    });
  });
});
