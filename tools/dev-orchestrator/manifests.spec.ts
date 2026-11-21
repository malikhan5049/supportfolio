import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { loadPlatformManifest, loadProjectManifests, shellAppFromManifest } from './manifests';

const root = join(__dirname, '..', '..');

function writeTempManifest(dir: string, projectId: string, content: string): string {
  const projectDir = join(dir, 'projects', projectId);
  mkdirSync(projectDir, { recursive: true });
  const manifestPath = join(projectDir, 'project.manifest.yaml');
  writeFileSync(manifestPath, content, 'utf8');
  return manifestPath;
}

describe('loadProjectManifests', () => {
  const manifests = loadProjectManifests(root);

  it('loads the tinyurl local section', () => {
    const tinyurl = manifests.find((manifest) => manifest.id === 'tinyurl');
    expect(tinyurl?.local?.service?.port).toBe(8082);
    expect(tinyurl?.local?.service?.managementPort).toBe(9093);
    expect(tinyurl?.local?.frontend?.devPort).toBe(4201);
    expect(tinyurl?.local?.dependsOn).toEqual(['identity']);
    expect(tinyurl?.local?.databases).toEqual(['postgres']);
  });

  it('loads the project openUrl and exposed modules', () => {
    const tinyurl = manifests.find((manifest) => manifest.id === 'tinyurl');
    expect(tinyurl?.openUrl).toBe('http://localhost:4201');
    expect(tinyurl?.exposedModules).toEqual([
      { name: 'card', version: '1.0.0', remoteEntry: 'http://localhost:4201/remoteEntry.js' },
    ]);
  });

  it('does not include the shell app', () => {
    expect(manifests.map((manifest) => manifest.id)).not.toContain('shell');
  });

  it('throws naming the manifest file when a manifest is invalid', () => {
    const dir = mkdtempSync(join(tmpdir(), 'manifest-invalid-'));
    try {
      writeTempManifest(
        dir,
        'broken',
        [
          'id: broken',
          'displayName: Broken',
          'local:',
          '  servicee:',
          '    gradleModule: "projects:broken:service"',
          '    port: 8099',
          '  dependsOn: []',
          '',
        ].join('\n'),
      );

      expect(() => loadProjectManifests(dir)).toThrow(/project\.manifest\.yaml/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('loadPlatformManifest', () => {
  const platform = loadPlatformManifest(join(root, 'platform', 'project.manifest.yaml'));

  it('parses the platform services in file order', () => {
    expect(platform.platformServices.map((service) => service.id)).toEqual([
      'postgres',
      'identity',
      'shell',
      'telemetry',
    ]);
  });

  it('parses the service details', () => {
    expect(platform.platformServices).toEqual([
      {
        id: 'postgres',
        kind: 'compose',
        composeFile: 'projects/tinyurl/docker-compose.yml',
        serviceName: 'postgres',
        port: 5432,
      },
      {
        id: 'identity',
        kind: 'gradle',
        gradleModule: 'platform:identity',
        port: 8081,
        managementPort: 9092,
        healthPath: '/actuator/health',
      },
      {
        id: 'shell',
        kind: 'gradle',
        gradleModule: 'platform:shell',
        port: 8080,
        managementPort: 9091,
        healthPath: '/actuator/health',
      },
      { id: 'telemetry', kind: 'compose-profile', profile: 'observability' },
    ]);
  });

  it('parses all reserved ports', () => {
    expect(platform.reservedPorts).toHaveLength(14);
    expect(platform.reservedPorts).toContainEqual({ port: 4201, owner: 'tinyurl-microfrontend' });
  });

  it('exposes the shell surface as an app manifest', () => {
    const shell = shellAppFromManifest(platform);
    expect(shell.id).toBe('shell');
    expect(shell.displayName).toBe('Supportfolio platform');
    expect(shell.local?.frontend?.nxProject).toBe('shell-host');
    expect(shell.local?.frontend?.devPort).toBe(4200);
    expect(shell.local?.dependsOn).toEqual(['identity', 'tinyurl', 'telemetry']);
  });

  it('throws when platformServices is missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'platform-manifest-'));
    try {
      const path = join(dir, 'project.manifest.yaml');
      writeFileSync(path, 'id: platform\ndisplayName: Incomplete\n', 'utf8');
      expect(() => loadPlatformManifest(path)).toThrow(
        'platform manifest missing platformServices',
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('shellAppFromManifest', () => {
  it('throws when surface.local is absent', () => {
    const platform = {
      id: 'platform',
      displayName: 'Platform',
      platformServices: [],
      reservedPorts: [],
    };
    expect(() => shellAppFromManifest(platform)).toThrow('platform manifest has no surface.local');
  });
});
