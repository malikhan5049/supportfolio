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

import type { ResolvedPlan } from './dev-orchestrator/plan';
import { main, parseArgs, runPreflight } from './dev-orchestrator';

type ConcurrentlyModule = { concurrently: jest.Mock };

const concurrently = jest.requireMock<ConcurrentlyModule>('concurrently').concurrently;

const repoRoot = path.join(__dirname, '..');
const USAGE = 'usage: tsx tools/dev-orchestrator.ts <plan|watch> <app> [--build-watch]';

function tempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'dev-orchestrator-'));
}

function registryPathIn(root: string): string {
  return path.join(root, 'platform', 'shell', 'config', 'remote-registry.dev.json');
}

/** A plan shaped like `buildProcessPlan` output, with commands under test control. */
function fakePlan(root: string, commands: string[]): ResolvedPlan {
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

async function bindBusyPort(): Promise<{ port: number; close: () => Promise<void> }> {
  const server = net.createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    // Bind every interface, like ports.spec.ts: `localhost` may resolve to ::1 first.
    server.listen(0, () => resolve());
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('expected a TCP address from the busy-port fixture');
  }
  return {
    port: address.port,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

async function freePortNumber(): Promise<number> {
  const { port, close } = await bindBusyPort();
  await close();
  return port;
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

describe('runPreflight', () => {
  it('fails first on a missing .env, naming scripts/dev-secrets.ps1', async () => {
    const root = tempRoot();

    await expect(runPreflight(fakePlan(root, ['npx nx serve shell-host']), {})).rejects.toThrow(
      `missing ${path.join(root, '.env')} \u2014 run scripts/dev-secrets.ps1 first`,
    );
  });

  it('fails on a missing dev key after .env exists, naming the openssl command', async () => {
    const root = tempRoot();
    writeEnvFile(root);

    await expect(runPreflight(fakePlan(root, ['npx nx serve shell-host']), {})).rejects.toThrow(
      `missing ${path.join(root, 'platform', 'identity', 'dev-key.pem')} \u2014 run: openssl genpkey -algorithm RSA -out platform/identity/dev-key.pem -pkeyopt rsa_keygen_bits:2048`,
    );
  });

  it('reports every busy planned port only after both files exist', async () => {
    const root = tempRoot();
    writeEnvFile(root);
    writeDevKey(root);
    const busy = await bindBusyPort();

    try {
      await expect(
        runPreflight(fakePlan(root, [`npx nx serve shell-host --port ${busy.port}`]), {}),
      ).rejects.toThrow(
        `port ${busy.port} is in use (owner: proc-0) \u2014 find it with: netstat -ano | findstr :${busy.port}`,
      );
    } finally {
      await busy.close();
    }
  });

  it('resolves when the files exist and the planned ports are free', async () => {
    const root = tempRoot();
    writeEnvFile(root);
    writeDevKey(root);
    const free = await freePortNumber();

    await expect(
      runPreflight(fakePlan(root, [`npx nx serve shell-host --port ${free}`]), {}),
    ).resolves.toBeUndefined();
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
    await main(['plan', 'shell'], { repoRoot });
    const plan = printedPlan();
    const registryPath = plan.registryPath;
    const previousRegistry = fs.existsSync(registryPath)
      ? fs.readFileSync(registryPath, 'utf8')
      : undefined;
    const root = tempRoot();
    const envFile = writeEnvFile(root);
    const devKey = writeDevKey(root);

    try {
      const code = await main(['watch', 'shell'], {
        repoRoot,
        env: { SUPPORTFOLIO_DEV_ENV_FILE: envFile, SUPPORTFOLIO_DEV_KEY_FILE: devKey },
      });

      expect(code).toBe(0);
      // Registry scope: project manifests only — the shell surface is never an app entry.
      expect(planIds(fs.readFileSync(registryPath, 'utf8'))).toEqual(['tinyurl']);
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
      expect(options).toEqual({ killOthersOn: ['failure'], prefix: 'name' });
    } finally {
      if (previousRegistry === undefined) {
        fs.rmSync(registryPath, { force: true });
      } else {
        fs.writeFileSync(registryPath, previousRegistry, 'utf8');
      }
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
