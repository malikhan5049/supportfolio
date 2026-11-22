import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { loadPlatformManifest, loadProjectManifests } from './manifests';
import type { PlatformManifest, ProjectManifest } from './manifests';
import { resolveOrder } from './closure';
import { collectPlannedPorts } from './ports';
import { generateDevRegistry, trustedOriginsFor } from './registry';
import { buildProcessPlan } from './plan';

/**
 * The executable form of "adding project #5 is a manifest plus one npm script": no real repo
 * manifest is read here, so the pipeline is proven generic rather than proven against today's data.
 */
const FOO_MANIFEST = [
  'id: foo',
  'displayName: Foo',
  'shortDescription: Synthetic second project',
  'features:',
  '  - A whole feature list, exactly like a real slice',
  // The schema requires at least one exposure; the derived-openUrl half stays unexercised by design.
  'exposedModules:',
  '  - name: card',
  '    version: 1.0.0',
  '    remoteEntry: http://localhost:4210/remoteEntry.js',
  'pipeline:',
  '  stages:',
  '    - build',
  '    - test',
  '    - deploy',
  'environments:',
  '  - dev',
  '  - test',
  '  - prod',
  'local:',
  '  service:',
  '    gradleModule: projects:foo:service',
  '    port: 8100',
  '    managementPort: 9100',
  '    healthPath: /actuator/health',
  '  frontend:',
  '    nxProject: foo-microfrontend',
  '    devPort: 4210',
  '    devRemoteEntry: http://localhost:4210/remoteEntry.js',
  '    distPath: custom/foo/out',
  '  dependsOn:',
  '    - identity',
  '  databases:',
  '    - postgres',
  '',
].join('\n');

const PLATFORM_MANIFEST = [
  'id: platform',
  'displayName: Platform',
  'reservedPorts:',
  '  - port: 8081',
  '    owner: identity',
  '  - port: 9092',
  '    owner: identity-management',
  'platformServices:',
  '  - id: identity',
  '    kind: gradle',
  '    gradleModule: platform:identity',
  '    port: 8081',
  '    managementPort: 9092',
  '    healthPath: /actuator/health',
  '  - id: postgres',
  '    kind: compose',
  '    composeFile: projects/foo/docker-compose.yml',
  '    serviceName: postgres',
  '    port: 5432',
  '  - id: shell',
  '    kind: gradle',
  '    gradleModule: platform:shell',
  '    port: 8080',
  '    managementPort: 9091',
  'surface:',
  '  local:',
  '    service:',
  '      gradleModule: platform:shell',
  '      port: 8080',
  '      managementPort: 9091',
  '      healthPath: /actuator/health',
  '    frontend:',
  '      nxProject: shell-host',
  '      devPort: 4200',
  '      devRemoteEntry: http://localhost:4200/remoteEntry.js',
  '    dependsOn: []',
  '',
].join('\n');

interface RegistryEntryView {
  id: string;
  openUrl: string;
  exposedModules: { remoteEntry: string }[];
}

describe('genericity: a hypothetical second project runs the full pipeline', () => {
  let root: string;
  let platform: PlatformManifest;
  let manifests: ProjectManifest[];
  let foo: ProjectManifest;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'genericity-'));
    mkdirSync(join(root, 'projects', 'foo'), { recursive: true });
    writeFileSync(join(root, 'projects', 'foo', 'project.manifest.yaml'), FOO_MANIFEST, 'utf8');
    writeFileSync(join(root, 'project.manifest.yaml'), PLATFORM_MANIFEST, 'utf8');

    platform = loadPlatformManifest(join(root, 'project.manifest.yaml'));
    manifests = loadProjectManifests(root);
    const loaded = manifests.find((manifest) => manifest.id === 'foo');
    if (!loaded) {
      throw new Error('synthetic foo manifest was not loaded');
    }
    foo = loaded;
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('resolves foo behind its declared dependency and database', () => {
    expect(resolveOrder('foo', manifests, platform)).toEqual(['identity', 'postgres', 'foo']);
  });

  it('collects foo ports (service, management and dev) alongside the platform ports', () => {
    expect(
      collectPlannedPorts(resolveOrder('foo', manifests, platform), manifests, platform),
    ).toEqual([8081, 9092, 5432, 8100, 9100, 4210]);
  });

  it('adds foo dev origin to the trusted origins', () => {
    expect(trustedOriginsFor(manifests)).toBe('http://localhost:4210');
  });

  it('generates a dev registry card for foo from its manifest alone', () => {
    const registry = JSON.parse(generateDevRegistry(manifests)) as {
      projects: RegistryEntryView[];
    };
    const entry = registry.projects.find((project) => project.id === 'foo');

    expect(entry?.openUrl).toBe('http://localhost:4210');
    expect(entry?.exposedModules.map((module) => module.remoteEntry)).toContain(
      'http://localhost:4210/remoteEntry.js',
    );
  });

  it('plans foo after identity health and the database port, its frontend right behind it', () => {
    const plan = buildProcessPlan('serve', foo, manifests, platform, root);

    expect(plan.processes.map((process) => process.name)).toEqual([
      'identity',
      'postgres',
      'foo-service',
      'foo-microfrontend',
      'compile',
    ]);
    expect(plan.processes[2].command).toBe(
      'wait-on -t 300000 http-get://localhost:9092/actuator/health tcp:127.0.0.1:5432 && ' +
        'gradlew.bat --no-daemon :projects:foo:service:bootRun --console=plain',
    );
    expect(plan.processes[3].command).toBe('npx nx serve foo-microfrontend');
    expect(plan.env.SUPPORTFOLIO_SHELL_TRUSTED_REMOTE_ORIGINS).toBe(
      'http://localhost:4210,http://localhost:4200',
    );
  });

  it('points the build-watch static locations at the manifest distPath', () => {
    const plan = buildProcessPlan('build-watch', foo, manifests, platform, root);

    expect(
      plan.env.SPRING_WEB_RESOURCES_STATIC_LOCATIONS.endsWith(join('custom', 'foo', 'out', '')),
    ).toBe(true);
  });
});
