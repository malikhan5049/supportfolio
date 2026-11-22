/**
 * CLI contract for the one-command dev start: argument parsing, preflight ordering,
 * plan output and the concurrently spawn (mocked — `concurrently` is ESM-only).
 */
import * as fs from 'node:fs';
import * as net from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';

// `concurrently` arrives with the devDependencies task; mock it virtually until it is installed.
jest.mock('concurrently', () => ({ concurrently: jest.fn(async () => []) }), { virtual: true });

// `watch` writes only the dev registry: hand the CLI a recorder over the real `fs` so the specs
// never touch the live `platform/shell/config/remote-registry.dev.json` file.
jest.mock('node:fs', () => {
  const actual = jest.requireActual<typeof import('node:fs')>('node:fs');
  // Own data properties only: `__importStar` copies own enumerable keys, not the prototype chain.
  const mocked = { ...actual };
  Object.defineProperty(mocked, 'writeFileSync', {
    value: jest.fn(actual.writeFileSync),
    writable: true,
    enumerable: true,
    configurable: true,
  });
  return mocked;
});

import type { ResolvedPlan } from './dev-orchestrator/plan';
import { main, parseArgs, plannedPorts, runPreflight, type PlanContext } from './dev-orchestrator';
import { loadPlatformManifest, loadProjectManifests } from './dev-orchestrator/manifests';
import * as ports from './dev-orchestrator/ports';

type ConcurrentlyModule = { concurrently: jest.Mock };

const concurrently = jest.requireMock<ConcurrentlyModule>('concurrently').concurrently;

const repoRoot = path.join(__dirname, '..');
const USAGE = 'usage: tsx tools/dev-orchestrator.ts <plan|watch> <app> [--build-watch]';
/** Every port the real `shell` plan binds — the host surface's 4200 included. */
const SHELL_PLANNED_PORTS = [4200, 4201, 5432, 8080, 8081, 8082, 9091, 9092, 9093];

function tempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'dev-orchestrator-'));
}

function registryPathIn(root: string): string {
  return path.join(root, 'platform', 'shell', 'config', 'remote-registry.dev.json');
}

/** Real manifests and platform, so the planned ports are the ones a developer would really get. */
function realContext(): PlanContext {
  return {
    appId: 'shell',
    manifests: loadProjectManifests(repoRoot),
    platform: loadPlatformManifest(path.join(repoRoot, 'platform', 'project.manifest.yaml')),
  };
}

/** A context whose port set is irrelevant: the file checks fail before any port is read. */
function stubContext(): PlanContext {
  return {
    appId: 'shell',
    manifests: [],
    platform: { id: 'platform', displayName: 'Platform', platformServices: [], reservedPorts: [] },
  };
}

/** Every planned port is free: preflight's file checks stay real, the OS probe does not. */
function portsAreFree(): jest.SpyInstance {
  return jest.spyOn(ports, 'checkPortsFree').mockResolvedValue([]);
}

/**
 * Binds one of the plan's real ports. A locally running stack may already own it — the port is
 * busy either way, which is exactly what preflight must refuse.
 */
async function occupyPlannedPort(port: number): Promise<() => Promise<void>> {
  const server = net.createServer();
  const bound = await new Promise<boolean>((resolve) => {
    // Bind every interface, like ports.spec.ts: `localhost` may resolve to ::1 first.
    server.once('error', () => resolve(false));
    server.listen(port, () => resolve(true));
  });

  if (!bound) {
    return async () => undefined;
  }
  return () => new Promise<void>((resolve) => server.close(() => resolve()));
}

interface CapturedWrite {
  path: string;
  data: string;
}

const writeFileSyncMock = fs.writeFileSync as unknown as jest.Mock;

/** Records the registry write instead of performing it: the repo file is never touched. */
function captureWrites(): { writes: CapturedWrite[]; restore: () => void } {
  const writes: CapturedWrite[] = [];
  const previous = writeFileSyncMock.getMockImplementation();

  writeFileSyncMock.mockImplementation(
    (file: fs.PathOrFileDescriptor, data: string | NodeJS.ArrayBufferView) => {
      writes.push({ path: String(file), data: String(data) });
    },
  );

  return {
    writes,
    restore: () => {
      if (previous) {
        writeFileSyncMock.mockImplementation(previous);
      }
    },
  };
}

/** A plan shaped like `buildProcessPlan` output, with only the registry path under test control. */
function fakePlan(root: string, commands: string[] = []): ResolvedPlan {
  return {
    processes: commands.map((command, index) => ({
      name: `proc-${index}`,
      color: 'white',
      command,
    })),
    env: {},
    registryPath: registryPathIn(root),
  };
}

function writeEnvFile(root: string): string {
  const envFile = path.join(root, '.env');
  fs.writeFileSync(envFile, 'IDENTITY_ISSUER=http://localhost:8081\n', 'utf8');
  return envFile;
}

function writeDevKey(root: string): string {
  const keyFile = path.join(root, 'platform', 'identity', 'dev-key.pem');
  fs.mkdirSync(path.dirname(keyFile), { recursive: true });
  fs.writeFileSync(
    keyFile,
    '-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----\n',
    'utf8',
  );
  return keyFile;
}

/** Preflight env overrides pointing at a temp `.env` and dev key. */
function watchEnv(root: string): Record<string, string> {
  return {
    SUPPORTFOLIO_DEV_ENV_FILE: writeEnvFile(root),
    SUPPORTFOLIO_DEV_KEY_FILE: writeDevKey(root),
  };
}

function planIds(registryText: string): string[] {
  return [...registryText.matchAll(/"id":\s*"([^"]+)"/g)].map((match) => match[1]);
}

describe('parseArgs', () => {
  it('parses the command and app id', () => {
    expect(parseArgs(['watch', 'shell'])).toEqual({
      command: 'watch',
      app: 'shell',
      buildWatch: false,
    });
  });

  it('parses --build-watch', () => {
    expect(parseArgs(['watch', 'tinyurl', '--build-watch'])).toEqual({
      command: 'watch',
      app: 'tinyurl',
      buildWatch: true,
    });
  });

  it('rejects an unknown command with the usage line', () => {
    expect(() => parseArgs(['bogus'])).toThrow(USAGE);
    expect(() => parseArgs([])).toThrow(USAGE);
    expect(() => parseArgs(['watch', 'a', 'b'])).toThrow(USAGE);
    expect(() => parseArgs(['watch', '--unknown'])).toThrow(USAGE);
  });
});

describe('plannedPorts', () => {
  it('derives every port the real shell plan binds, host surface included', () => {
    expect(plannedPorts(realContext()).sort((a, b) => a - b)).toEqual(SHELL_PLANNED_PORTS);
  });
});

describe('runPreflight', () => {
  it('fails first on a missing .env, naming scripts/dev-secrets.ps1', async () => {
    const root = tempRoot();

    await expect(
      runPreflight(fakePlan(root, ['npx nx serve shell-host']), {}, stubContext()),
    ).rejects.toThrow(
      `missing ${path.join(root, '.env')} \u2014 run scripts/dev-secrets.ps1 first`,
    );
  });

  it('fails on a missing dev key after .env exists, naming the openssl command', async () => {
    const root = tempRoot();
    writeEnvFile(root);

    await expect(
      runPreflight(fakePlan(root, ['npx nx serve shell-host']), {}, stubContext()),
    ).rejects.toThrow(
      `missing ${path.join(root, 'platform', 'identity', 'dev-key.pem')} \u2014 run: openssl genpkey -algorithm RSA -out platform/identity/dev-key.pem -pkeyopt rsa_keygen_bits:2048`,
    );
  });

  it('refuses to start when a planned port is taken, naming the manifest owner', async () => {
    const root = tempRoot();
    writeEnvFile(root);
    writeDevKey(root);

    const context = realContext();
    const release = await occupyPlannedPort(4200);

    try {
      const busy = await ports.checkPortsFree(plannedPorts(context));
      expect(busy.length).toBeGreaterThan(0);

      const [first] = busy;
      const owner =
        context.platform.reservedPorts.find((entry) => entry.port === first.port)?.owner ??
        'unknown';

      await expect(runPreflight(fakePlan(root), {}, context)).rejects.toThrow(
        `port ${first.port} is in use (owner: ${owner}) \u2014 find it with: netstat -ano | findstr :${first.port}`,
      );
    } finally {
      await release();
    }
  });

  it('resolves when the files exist and every planned port is free', async () => {
    const root = tempRoot();
    writeEnvFile(root);
    writeDevKey(root);

    const freePorts = portsAreFree();
    try {
      await expect(runPreflight(fakePlan(root), {}, realContext())).resolves.toBeUndefined();
      expect(freePorts).toHaveBeenCalled();
    } finally {
      freePorts.mockRestore();
    }
  });
});

describe('main', () => {
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    concurrently.mockClear();
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  function printedPlan(): ResolvedPlan {
    const printed = logSpy.mock.calls[0]?.[0];
    if (typeof printed !== 'string') {
      throw new Error('expected the plan command to print the resolved plan JSON');
    }
    return JSON.parse(printed) as ResolvedPlan;
  }

  it('prints the resolved plan for `plan` and spawns nothing', async () => {
    const code = await main(['plan', 'shell'], { repoRoot });
    const plan = printedPlan();

    expect(code).toBe(0);
    expect(concurrently).not.toHaveBeenCalled();
    expect(plan.processes).toHaveLength(7);
    expect(plan.registryPath).toBe(registryPathIn(repoRoot));
  });

  it('keeps the shell origin in the trusted remote origins', async () => {
    const code = await main(['plan', 'shell'], { repoRoot });
    const plan = printedPlan();

    expect(code).toBe(0);
    expect(plan.env['SUPPORTFOLIO_SHELL_TRUSTED_REMOTE_ORIGINS']).toContain(
      'http://localhost:4200',
    );
  });

  it('writes a project-only registry and spawns the plan under concurrently', async () => {
    const code0 = await main(['plan', 'shell'], { repoRoot });
    const plan = printedPlan();
    expect(code0).toBe(0);

    const env = watchEnv(tempRoot());
    const freePorts = portsAreFree();
    const captured = captureWrites();

    try {
      const code = await main(['watch', 'shell'], { repoRoot, env });

      expect(code).toBe(0);
      // Registry scope: project manifests only — the shell surface is never an app entry.
      expect(captured.writes).toHaveLength(1);
      expect(captured.writes[0].path).toBe(plan.registryPath);
      expect(planIds(captured.writes[0].data)).toEqual(['tinyurl']);
      // Preflight really ran the port gate here (mocked, not skipped).
      expect(freePorts).toHaveBeenCalled();
      expect(concurrently).toHaveBeenCalledTimes(1);

      const [mapped, options] = concurrently.mock.calls[0] as [
        { command: string; name: string; prefixColor: string }[],
        unknown,
      ];
      expect(mapped).toHaveLength(7);
      expect(mapped).toEqual(
        plan.processes.map((process) => ({
          command: process.command,
          name: process.name,
          prefixColor: process.color,
        })),
      );
      // The derived env reaches the children: the registry path and the CSP origins are only
      // meaningful inside the Spring processes.
      expect(options).toEqual(
        expect.objectContaining({ killOthersOn: ['failure'], prefix: 'name', env: plan.env }),
      );
    } finally {
      captured.restore();
      freePorts.mockRestore();
    }
  });

  it('exits 1 when a child crashes, even though concurrently resolves', async () => {
    concurrently.mockResolvedValueOnce([
      { name: 'identity', exitCode: 0 },
      { name: 'shell', exitCode: 1 },
    ]);

    const env = watchEnv(tempRoot());
    const freePorts = portsAreFree();
    const captured = captureWrites();

    try {
      const code = await main(['watch', 'shell'], { repoRoot, env });

      // `killOthersOn: ['failure']` stops the siblings but resolves: the exit code must not lie.
      expect(concurrently).toHaveBeenCalledTimes(1);
      expect(code).toBe(1);
    } finally {
      captured.restore();
      freePorts.mockRestore();
    }
  });

  it('honours --build-watch through the plan process commands', async () => {
    await main(['plan', 'shell', '--build-watch'], { repoRoot });
    const plan = printedPlan();

    expect(plan.processes.some((process) => /build-watch|--watch/.test(process.command))).toBe(
      true,
    );
  });

  it('reports a failed preflight on stderr and returns 1', async () => {
    const missingEnv = path.join(tempRoot(), '.env');
    const code = await main(['watch', 'shell'], {
      repoRoot,
      env: { SUPPORTFOLIO_DEV_ENV_FILE: missingEnv },
    });

    expect(code).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(
      `missing ${missingEnv} \u2014 run scripts/dev-secrets.ps1 first`,
    );
    expect(concurrently).not.toHaveBeenCalled();
  });

  it('reports the usage line for a bad command line', async () => {
    const code = await main(['bogus'], { repoRoot });

    expect(code).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(USAGE);
  });
});
