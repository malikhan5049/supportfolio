/**
 * One-command dev start: resolves the process plan for an app, refuses to start when the
 * local prerequisites are missing or a planned port is taken, then hands the plan to
 * `concurrently`.
 *
 * CLI: npx tsx tools/dev-orchestrator.ts <plan|watch> [<app>] [--build-watch]
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';

import {
  loadPlatformManifest,
  loadProjectManifests,
  shellAppFromManifest,
} from './dev-orchestrator/manifests';
import { buildProcessPlan, type PlanMode, type ResolvedPlan } from './dev-orchestrator/plan';
import { checkPortsFree } from './dev-orchestrator/ports';
import { generateDevRegistry } from './dev-orchestrator/registry';

const USAGE = 'usage: tsx tools/dev-orchestrator.ts <plan|watch> <app> [--build-watch]';
const BUILD_WATCH_FLAG = '--build-watch';
const DEFAULT_APP_ID = 'shell';
const PLATFORM_MANIFEST = ['platform', 'project.manifest.yaml'];
const DEV_KEY_FILE = ['platform', 'identity', 'dev-key.pem'];
const ENV_FILE = '.env';

/** Test/CI escape hatches: point preflight at fixtures instead of the repo-standard files. */
const ENV_FILE_OVERRIDE = 'SUPPORTFOLIO_DEV_ENV_FILE';
const DEV_KEY_OVERRIDE = 'SUPPORTFOLIO_DEV_KEY_FILE';

const CONCURRENTLY_MODULE = 'concurrently';

interface ConcurrentlyModule {
  concurrently: (
    commands: { command: string; name: string; prefixColor: string }[],
    options: { killOthersOn: 'failure'[]; prefix: 'name' },
  ) => Promise<unknown>;
}

export interface DevArgs {
  command: 'plan' | 'watch';
  app?: string;
  buildWatch: boolean;
}

export interface MainOptions {
  repoRoot?: string;
  env?: Record<string, string>;
}

export function parseArgs(argv: string[]): DevArgs {
  const [command, ...rest] = argv;
  if (command !== 'plan' && command !== 'watch') {
    throw new Error(USAGE);
  }

  let app: string | undefined;
  let buildWatch = false;
  for (const arg of rest) {
    if (arg === BUILD_WATCH_FLAG) {
      buildWatch = true;
    } else if (arg.startsWith('-') || app !== undefined) {
      throw new Error(USAGE);
    } else {
      app = arg;
    }
  }

  return { command, app, buildWatch };
}

/**
 * Fails in a fixed order so the first message is always the next thing to fix:
 * missing `.env` → missing identity dev key → busy planned port. Generates nothing.
 */
export async function runPreflight(plan: ResolvedPlan, env: Record<string, string>): Promise<void> {
  const repoRoot = repoRootOf(plan.registryPath);

  const envFile = env[ENV_FILE_OVERRIDE] ?? path.join(repoRoot, ENV_FILE);
  if (!existsSync(envFile)) {
    throw new Error(`missing ${envFile} \u2014 run scripts/dev-secrets.ps1 first`);
  }

  const devKey = env[DEV_KEY_OVERRIDE] ?? path.join(repoRoot, ...DEV_KEY_FILE);
  if (!existsSync(devKey)) {
    throw new Error(
      `missing ${devKey} \u2014 run: openssl genpkey -algorithm RSA -out platform/identity/dev-key.pem -pkeyopt rsa_keygen_bits:2048`,
    );
  }

  const planned = plannedPorts(plan);
  const busy = await checkPortsFree(planned.map((entry) => entry.port));
  for (const { port } of busy) {
    const owner = planned.find((entry) => entry.port === port)?.owner ?? 'unknown';
    throw new Error(
      `port ${port} is in use (owner: ${owner}) \u2014 find it with: netstat -ano | findstr :${port}`,
    );
  }
}

export async function main(argv: string[], options: MainOptions = {}): Promise<number> {
  const repoRoot = options.repoRoot ?? process.cwd();
  try {
    const { command, app, buildWatch } = parseArgs(argv);
    const plan = buildPlan(app, repoRoot, buildWatch);

    if (command === 'plan') {
      console.log(JSON.stringify(plan, null, 2));
      return 0;
    }

    await runPreflight(plan, options.env ?? {});

    // The registry mirrors what dev actually runs: project manifests only.
    mkdirSync(path.dirname(plan.registryPath), { recursive: true });
    writeFileSync(plan.registryPath, generateDevRegistry(loadProjectManifests(repoRoot)), 'utf8');

    // `concurrently` is an ESM-only dependency installed with the devDependencies task; the
    // specifier stays indirect so this module type-checks before the package exists on disk.
    const { concurrently } = (await import(CONCURRENTLY_MODULE)) as ConcurrentlyModule;
    await concurrently(
      plan.processes.map((process) => ({
        command: process.command,
        name: process.name,
        prefixColor: process.color,
      })),
      { killOthersOn: ['failure'], prefix: 'name' },
    );
    return 0;
  } catch (error) {
    console.error(getMessage(error));
    return 1;
  }
}

function buildPlan(app: string | undefined, repoRoot: string, buildWatch: boolean): ResolvedPlan {
  const appId = app ?? DEFAULT_APP_ID;
  const manifests = loadProjectManifests(repoRoot);
  const platform = loadPlatformManifest(path.join(repoRoot, ...PLATFORM_MANIFEST));

  const manifest =
    manifests.find((candidate) => candidate.id === appId) ??
    (appId === DEFAULT_APP_ID && platform.surface?.local
      ? shellAppFromManifest(platform)
      : undefined);
  if (!manifest) {
    throw new Error(`unknown app id "${appId}"`);
  }

  const mode: PlanMode = buildWatch ? 'build-watch' : 'serve';
  return buildProcessPlan(mode, manifest, manifests, platform, repoRoot);
}

/** `<root>/platform/shell/config/remote-registry.dev.json` → `<root>`. */
function repoRootOf(registryPath: string): string {
  return path.resolve(registryPath, '..', '..', '..', '..');
}

/**
 * Ports the resolved plan actually binds: `--port <p>`, `localhost:<p>`, `127.0.0.1:<p>`.
 * The first process naming a port owns it for the failure message.
 */
function plannedPorts(plan: ResolvedPlan): { port: number; owner: string }[] {
  const seen = new Map<number, string>();
  for (const process of plan.processes) {
    for (const match of process.command.matchAll(
      /--port[= ](\d+)|localhost:(\d+)|127\.0\.0\.1:(\d+)/g,
    )) {
      const port = Number(match[1] ?? match[2] ?? match[3]);
      if (!seen.has(port)) {
        seen.set(port, process.name);
      }
    }
  }
  return [...seen].map(([port, owner]) => ({ port, owner }));
}

function getMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

if (require.main === module) {
  void main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
