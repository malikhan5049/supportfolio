import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { isAbsolute, join } from 'path';
import { loadPlatformManifest, loadProjectManifests, shellAppFromManifest } from './manifests';
import type { PlatformManifest, ProjectManifest } from './manifests';
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
  'compile',
];

const SHELL_SERVE_COMMANDS = [
  'gradlew.bat --no-daemon :platform:identity:bootRun --console=plain',
  'docker compose -p supportfolio-dev -f projects/tinyurl/docker-compose.yml up -d --wait postgres',
  'wait-on -t 300000 http-get://localhost:9092/actuator/health tcp:127.0.0.1:5432 && gradlew.bat --no-daemon :projects:tinyurl:service:bootRun --console=plain',
  'npx nx serve tinyurl-microfrontend',
  'docker compose -p supportfolio-dev -f docker-compose.demo.yml -f docker-compose.dev.yml --profile observability up -d --wait --no-deps prometheus grafana',
  'wait-on -t 300000 http-get://localhost:9092/actuator/health http-get://localhost:9093/actuator/health tcp:127.0.0.1:5432 && gradlew.bat --no-daemon :platform:shell:bootRun --console=plain',
  'npx nx serve shell-host',
  'gradlew.bat -t :platform:identity:classes :projects:tinyurl:service:classes :platform:shell:classes --console=plain',
];

const SHELL_COLORS = ['green', 'gray', 'magenta', 'yellow', 'cyan', 'blue', 'yellow', 'red'];

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
        'compile',
      ]);
      expect(plan.processes).toHaveLength(5);
    });

    it('keeps the host surface origin in the CSP list when the closure omits it', () => {
      const plan = buildProcessPlan('serve', tinyurl, manifests, platform, FAKE_REPO_ROOT);

      // The shell is not in the resolved order here: its origin comes from the surface lift alone.
      expect(plan.processes.map((process) => process.name)).not.toContain('shell-host');
      expect(plan.env.SUPPORTFOLIO_SHELL_TRUSTED_REMOTE_ORIGINS).toBe(
        'http://localhost:4200,http://localhost:4201',
      );
    });

    it('parses the repo .env: comments and blank lines skipped, values keep their own "="', () => {
      const root = mkdtempSync(join(tmpdir(), 'plan-env-'));
      try {
        writeFileSync(
          join(root, '.env'),
          [
            '# local secrets, never committed',
            '',
            'IDENTITY_ISSUER=http://localhost:8081',
            'DATABASE_PASSWORD=a=b',
            'NO_SEPARATOR',
            '',
          ].join('\n'),
          'utf8',
        );

        const plan = buildProcessPlan('serve', tinyurl, manifests, platform, root);

        expect(plan.env.IDENTITY_ISSUER).toBe('http://localhost:8081');
        expect(plan.env.DATABASE_PASSWORD).toBe('a=b');
        expect(plan.env.NO_SEPARATOR).toBeUndefined();
        expect(Object.keys(plan.env).some((key) => key.startsWith('#'))).toBe(false);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });

    it('throws on a declared but unimplemented local.service.envFile', () => {
      const withEnvFile: ProjectManifest = {
        ...tinyurl,
        local: {
          ...tinyurl.local,
          service: {
            ...tinyurl.local?.service,
            gradleModule: 'projects:tinyurl:service',
            port: 8082,
            envFile: '.env.tinyurl',
          },
        },
      };

      expect(() =>
        buildProcessPlan('serve', withEnvFile, [withEnvFile], platform, FAKE_REPO_ROOT),
      ).toThrow('local.service.envFile is not supported yet');
    });

    it('plans a pure-frontend dependency without inventing a service process', () => {
      const cards: ProjectManifest = {
        id: 'cards',
        displayName: 'Cards',
        local: {
          frontend: {
            nxProject: 'cards-microfrontend',
            devPort: 4203,
            devRemoteEntry: 'http://localhost:4203/remoteEntry.js',
          },
          dependsOn: [],
        },
      };
      const consumer: ProjectManifest = {
        id: 'consumer',
        displayName: 'Consumer',
        local: {
          service: { gradleModule: 'projects:consumer:service', port: 8099 },
          dependsOn: ['cards'],
        },
      };

      const plan = buildProcessPlan('serve', consumer, [cards, consumer], platform, FAKE_REPO_ROOT);

      expect(plan.processes.map((process) => process.name)).toEqual([
        'cards-microfrontend',
        'consumer-service',
        'compile',
      ]);
    });

    it('gates every compose dependency on its tcp port, not just the database', () => {
      const withCache: PlatformManifest = {
        ...platform,
        platformServices: [
          ...platform.platformServices,
          {
            id: 'redis',
            kind: 'compose',
            composeFile: 'docker-compose.redis.yml',
            serviceName: 'redis',
            port: 6379,
          },
        ],
      };
      const cacheConsumer: ProjectManifest = {
        id: 'cache-consumer',
        displayName: 'Cache consumer',
        local: {
          service: { gradleModule: 'projects:cache-consumer:service', port: 8099 },
          dependsOn: [],
          databases: ['redis'],
        },
      };

      const plan = buildProcessPlan(
        'serve',
        cacheConsumer,
        [cacheConsumer],
        withCache,
        FAKE_REPO_ROOT,
      );

      expect(plan.processes.map((process) => process.name)).toEqual([
        'redis',
        'cache-consumer-service',
        'compile',
      ]);
      expect(plan.processes[1].command).toBe(
        'wait-on -t 300000 tcp:127.0.0.1:6379 && gradlew.bat --no-daemon :projects:cache-consumer:service:bootRun --console=plain',
      );
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

    it('honours a manifest-declared distPath over the default layout', () => {
      const customLayout: ProjectManifest = {
        ...tinyurl,
        local: {
          ...tinyurl.local,
          frontend: {
            nxProject: 'tinyurl-microfrontend',
            devPort: 4201,
            devRemoteEntry: 'http://localhost:4201/remoteEntry.js',
            distPath: 'custom/tinyurl/out',
          },
        },
      };

      const plan = buildProcessPlan(
        'build-watch',
        customLayout,
        [customLayout],
        platform,
        FAKE_REPO_ROOT,
      );

      expect(
        plan.env.SPRING_WEB_RESOURCES_STATIC_LOCATIONS.endsWith(
          join('dist', 'custom', 'tinyurl', 'out', ''),
        ),
      ).toBe(true);
    });
  });
});
