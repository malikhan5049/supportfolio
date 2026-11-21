/**
 * One-command dev start: resolves the process plan for an app, refuses to start when the
 * local prerequisites are missing or a planned port is taken, then hands the plan to
 * `concurrently`.
 *
 * CLI: npx tsx tools/dev-orchestrator.ts <plan|watch> [<app>] [--build-watch]
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';

import { resolveOrder } from './dev-orchestrator/closure';
import {
  loadPlatformManifest,
  loadProjectManifests,
  shellAppFromManifest,
  type PlatformManifest,
  type ProjectManifest,
} from './dev-orchestrator/manifests';
import { buildProcessPlan, type PlanMode, type ResolvedPlan } from './dev-orchestrator/plan';
import {
  checkPortsFree,
  collectPlannedPorts,
  findPortConflicts,
  type PortConflict,
} from './dev-orchestrator/ports';
import { generateDevRegistry } from './dev-orchestrator/registry';

const USAGE = 'usage: tsx tools/dev-orchestrator.ts <plan|watch> <app> [--build-watch]';
const BUILD_WATCH_FLAG = '--build-watch';
const DEFAULT_APP_ID = 'shell';
/** Host app: its local section lives in the platform manifest's `surface.local`, not in a project. */
const SURFACE_APP_ID = 'shell';
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

/** The manifests the plan was resolved from: the only source of truth for the planned ports. */
export interface PlanContext {
  appId: string;
  manifests: ProjectManifest[];
  platform: PlatformManifest;
}

interface ResolvedDevPlan {
  plan: ResolvedPlan;
  context: PlanContext;
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
 * missing `.env` → missing identity dev key → duplicated or busy planned port. Generates nothing.
 */
export async function runPreflight(
  plan: ResolvedPlan,
  env: Record<string, string>,
  context?: PlanContext,
): Promise<void> {
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

  // Without the manifests there are no planned ports to derive; the CLI always passes them.
  if (!context) {
    return;
  }

  const planned = plannedPorts(context);
  const [duplicate] = findPortConflicts(planned, context.platform);
  if (duplicate) {
    throw new Error(busyPortMessage(duplicate));
  }

  for (const { port } of await checkPortsFree(planned)) {
    throw new Error(busyPortMessage({ port, owner: ownerOf(port, context.platform) }));
  }
}

export async function main(argv: string[], options: MainOptions = {}): Promise<number> {
  const repoRoot = options.repoRoot ?? process.cwd();
  try {
    const { command, app, buildWatch } = parseArgs(argv);
    const { plan, context } = buildPlan(app, repoRoot, buildWatch);

    if (command === 'plan') {
      console.log(JSON.stringify(plan, null, 2));
      return 0;
    }

    await runPreflight(plan, options.env ?? {}, context);

    // The registry mirrors what dev actually runs: project manifests only.
    mkdirSync(path.dirname(plan.registryPath), { recursive: true });
    writeFileSync(plan.registryPath, generateDevRegistry(loadProjectManifests(repoRoot)), 'utf8');

    // `concurrently` is an ESM-only dependency installed with the devDependencies task; the
    // specifier stays indirect so this module type-checks before the package exists on disk.
    const { concurrently } = (await import(CONCURRENTLY_MODULE)) as ConcurrentlyModule;
    const results = await concurrently(
      plan.processes.map((process) => ({
        command: process.command,
        name: process.name,
        prefixColor: process.color,
      })),
      { killOthersOn: ['failure'], prefix: 'name' },
    );
    return anyChildFailed(results) ? 1 : 0;
  } catch (error) {
    console.error(getMessage(error));
    return 1;
  }
}

/** Every port the plan binds, in dependency order — read from the manifests, never scraped. */
export function plannedPorts(context: PlanContext): number[] {
  const order = resolveOrder(context.appId, context.manifests, context.platform);
  return collectPlannedPorts(order, manifestsWithSurface(context), context.platform);
}

/**
 * The host app's local section (its frontend port) lives in the platform manifest's
 * `surface.local`, so the port collector only sees it through a synthetic app entry — the same
 * trick `buildProcessPlan` plays for the trusted origins.
 */
function manifestsWithSurface(context: PlanContext): ProjectManifest[] {
  if (!context.platform.surface?.local) {
    return context.manifests;
  }
  if (context.manifests.some((manifest) => manifest.id === SURFACE_APP_ID)) {
    return context.manifests;
  }
  return [...context.manifests, shellAppFromManifest(context.platform)];
}

function buildPlan(
  app: string | undefined,
  repoRoot: string,
  buildWatch: boolean,
): ResolvedDevPlan {
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
  return {
    plan: buildProcessPlan(mode, manifest, manifests, platform, repoRoot),
    context: { appId: manifest.id, manifests, platform },
  };
}

/** `<root>/platform/shell/config/remote-registry.dev.json` → `<root>`. */
function repoRootOf(registryPath: string): string {
  return path.resolve(registryPath, '..', '..', '..', '..');
}

/** The port's owner is the reserved-port entry, so the message names a service, not a process. */
function ownerOf(port: number, platform: PlatformManifest): string {
  return platform.reservedPorts.find((entry) => entry.port === port)?.owner ?? 'unknown';
}

function busyPortMessage({ port, owner }: PortConflict): string {
  return `port ${port} is in use (owner: ${owner}) \u2014 find it with: netstat -ano | findstr :${port}`;
}

/**
 * `killOthersOn: ['failure']` stops the siblings but still resolves, so the exit codes are the
 * only signal that a child crashed: `watch` must not report success over a dead stack.
 */
function anyChildFailed(results: unknown): boolean {
  if (!Array.isArray(results)) {
    return false;
  }

  return results.some((result: unknown) => {
    if (typeof result !== 'object' || result === null) {
      return false;
    }
    const exitCode = (result as { exitCode?: unknown }).exitCode;
    return typeof exitCode === 'number' && exitCode !== 0;
  });
}

function getMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

if (require.main === module) {
  void main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
