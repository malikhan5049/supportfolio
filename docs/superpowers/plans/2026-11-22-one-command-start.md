# One-command start (dev + prod) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the six-terminal dev boot and multi-command prod boot with one manifest-driven command per project and mode (`watch:*`, `build-watch:*`, `prod:*`, `stop`).
**Architecture:** A manifest-driven Node orchestrator in `tools/` loads `projects/*/project.manifest.yaml` plus `platform/project.manifest.yaml`, resolves the `dependsOn`/`databases` closure by topological sort, runs a port/preflight gate, generates the shell's dev registry and trusted-origin list, then spawns the resolved process list through `concurrently` with `wait-on` health guards and one shared absolute-path env map. The same manifests drive the registry, the CSP origins and the port preflight, so adding project #4 is a manifest entry, not an orchestrator change.
**Tech Stack:** Node 24 / TypeScript (tools/), PowerShell, Gradle 8 (Boot 4.1.1, JDK 17), Nx 24 / Angular 22, Docker Compose v2
**Spec:** docs/superpowers/specs/2026-11-22-one-command-start-design.md

## Global Constraints

- Work on branch `feat/one-command-start` (create in Task 0); never commit to `main`; conventional commits (CI-enforced).
- Windows-first: npm scripts run under cmd.exe; use `gradlew.bat` locally; every path passed to a Spring process must be ABSOLUTE (`bootRun` CWD = the module directory).
- Do not touch: `platform/shell/config/remote-registry.json`, `scripts/demo.ps1`, `docker-compose.demo.yml`, anything under `.github/`, `platform/identity/dev-key.pem` (never commit/move/copy; generate locally with openssl if missing).
- `tools/` is plain Node/Jest TS, NOT on the Nx graph. Test command: `npx jest --selectProjects tools --testPathPattern <pattern>`. Prettier gate: `npx prettier --check "platform/**/*.{ts,html}" "tools/**/*.ts" "eslint.config.mjs" "jest.config.ts" "jest.preset.js"`.
- Spring DevTools goes in the `developmentOnly` configuration only; LiveReload is disabled via env `SPRING_DEVTOOLS_LIVERELOAD_ENABLED=false` on every devtools service (three instances would race for port 35729).
- Reserved port map (platform manifest owns it): 4200 shell-host, 4201 tinyurl-mf, 8080 shell gateway, 8081 identity, 8082 tinyurl-service, 8083 spare, 5432 postgres, 9091/9092/9093 management, 18080 shell demo, 18082 tinyurl standalone, 19090 prometheus, 13000 grafana.
- Dev containers always run under compose project name `supportfolio-dev` so `down` can never touch the demo stack's volumes.
- JDK 17, Boot 4.1.1, Angular 22, Nx 24, Node 24. Backend test convention: Testcontainers (Docker required) — not used by this plan except for the existing suite.

## Review Focus

1. Port already in use (demo stack running, IDE holding 4200) → the orchestrator names the owning PID and exits BEFORE spawning anything (pinning test: `ports.spec.ts` binds a listener and expects `checkPortsFree` to flag it).
2. A manifest `dependsOn`/`databases` id that no manifest or platform service declares → fail fast naming both ids, before any process starts (pinning test: `closure.spec.ts` cycle + unknown-ref cases).
3. DevTools LiveReload port race on 35729 → every devtools process command carries `SPRING_DEVTOOLS_LIVERELOAD_ENABLED=false` in the resolved env (pinning test: `plan.spec.ts` asserts the env key).
4. A relative path reaching a Spring process (registry file, key file, static-locations) → the resolved env map contains only absolute paths for these three keys (pinning test: `plan.spec.ts` asserts `path.isAbsolute`).
5. Running `npx nx e2e shell-host-e2e` while `watch:*` is up → port 4200/4201 bind failure; documented as mutually exclusive in both READMEs (pinning step: the docs task asserts the note exists).

---

## Reconciled details (read before Task 1)

Three facts of the repo force these shapes; everything else follows the brief verbatim.

- **R1 — the `shell` app needs a recipe, and it cannot be a project manifest.** `project.manifest.schema.json` requires `exposedModules` with `contains: {name: "card"}` and the shell exposes no module, so the shell surface is declared inside `platform/project.manifest.yaml` as a `surface.local` block and lifted into a `ProjectManifest` by `shellAppFromManifest(platform)`. `platform/project.manifest.yaml` is parsed by `loadPlatformManifest` with `js-yaml` only — it is not validated against the project schema (which is why top-level `additionalProperties: false` in Task 1 is safe).
- **R2 — the generated registry envelope copies the committed one.** `registry.spec.ts` asserts `Object.keys(generated) === Object.keys(platform/shell/config/remote-registry.json)`; the committed file is read, never written.
- **R3 — `concurrently` is ESM-only.** The spawner uses `await import('concurrently')` (dynamic import) and passes commands as objects, never through a shell.

---

## Task 0: Branch

**Files**
- Create: git branch `feat/one-command-start`

**Interfaces**
- None (no code).

- [ ] **Step 1: Confirm the worktree is clean**

Run: `git status --porcelain`
Expected: no output. If there is output, stop and report the dirty paths — do not stash.

- [ ] **Step 2: Create the branch**

Run: `git switch -c feat/one-command-start`
Expected: `Switched to a new branch 'feat/one-command-start'`

- [ ] **Step 3: Confirm the branch**

Run: `git rev-parse --abbrev-ref HEAD`
Expected: `feat/one-command-start`

No commit in this task.

---

## Task 1: Manifest schema v2 + manifest data

**Files**
- Modify: `platform/harness/manifest-schema/project.manifest.schema.json`
- Modify: `projects/tinyurl/project.manifest.yaml`
- Create: `platform/project.manifest.yaml`
- Modify: `tools/validate-manifest.spec.ts`
- Create: `tools/fixtures/valid-manifest-local.yaml`
- Create: `tools/fixtures/invalid-manifest-local-typo.yaml`

**Interfaces**
- Consumes: `validateManifest(manifestYaml: string): ManifestValidationResult` from `tools/validate-manifest.ts`; `validateAllManifests(projectsDir: string): ManifestValidationResult[]` from `tools/validate-all-manifests.ts`.
- Produces: the on-disk manifest contracts that `loadProjectManifests`/`loadPlatformManifest` (Task 2) parse.

- [ ] **Step 1: Write the failing fixtures and specs**

Create `tools/fixtures/valid-manifest-local.yaml` — the tinyurl manifest body with a `local` block, `openUrl`, one `card` exposed module, `pipeline` and `environments`, exactly as the tinyurl manifest will look after Step 4.

Create `tools/fixtures/invalid-manifest-local-typo.yaml` — identical to the valid fixture except the `local` block spells `dependOn: ["identity"]` (typo, one `s` short) instead of `dependsOn`.

Append to `tools/validate-manifest.spec.ts`:

```ts
describe('local section', () => {
  it('accepts a manifest with a local recipe (valid-manifest-local.yaml)', () => {
    const result = validateManifest(readFileSync(join(__dirname, 'fixtures/valid-manifest-local.yaml'), 'utf8'));
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects a typo inside local (invalid-manifest-local-typo.yaml)', () => {
    const result = validateManifest(readFileSync(join(__dirname, 'fixtures/invalid-manifest-local-typo.yaml'), 'utf8'));
    expect(result.valid).toBe(false);
    expect(result.errors.join('\n')).toContain('additionalProperties');
  });

  it('validates the real tinyurl manifest with its local block', () => {
    const result = validateAllManifests(join(__dirname, '..', 'projects'))[0];
    expect(result.valid).toBe(true);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx jest --selectProjects tools --testPathPattern validate-manifest`
Expected: the two new fixture tests fail — the valid fixture is rejected once `additionalProperties: false` exists (unknown `local`/`openUrl` keys) and the typo fixture is wrongly accepted (`Received: true`). The real-manifest test may pass before Step 4; the two fixture failures are the gate.

- [ ] **Step 3: Extend the schema**

In `platform/harness/manifest-schema/project.manifest.schema.json`: add `"additionalProperties": false` next to `"type": "object"` at the top level; add an `openUrl` property `{ "type": "string" }` to `properties`; add the `local` property; leave `exposedModules` (including `contains: {name: "card"}`) untouched.

```json
"openUrl": { "type": "string" },
"local": {
  "type": "object",
  "additionalProperties": false,
  "required": ["dependsOn"],
  "properties": {
    "service": {
      "type": "object",
      "additionalProperties": false,
      "required": ["gradleModule", "port"],
      "properties": {
        "gradleModule": { "type": "string" },
        "port": { "type": "integer" },
        "managementPort": { "type": "integer" },
        "healthPath": { "type": "string" },
        "envFile": { "type": "string" }
      }
    },
    "frontend": {
      "type": "object",
      "additionalProperties": false,
      "required": ["nxProject", "devPort", "devRemoteEntry"],
      "properties": {
        "nxProject": { "type": "string" },
        "devPort": { "type": "integer" },
        "devRemoteEntry": { "type": "string" },
        "standaloneBuild": { "type": "string" }
      }
    },
    "dependsOn": { "type": "array", "items": { "type": "string" } },
    "databases": { "type": "array", "items": { "type": "string" } }
  }
}
```

Note: `pipeline` keeps its current shape (no `additionalProperties: false` inside it) — out of scope.

- [ ] **Step 4: Add the manifest data**

Append to `projects/tinyurl/project.manifest.yaml` exactly:

```yaml
local:
  service:
    gradleModule: "projects:tinyurl:service"
    port: 8082
    managementPort: 9093
    healthPath: "/actuator/health"
  frontend:
    nxProject: "tinyurl-microfrontend"
    devPort: 4201
    devRemoteEntry: "http://localhost:4201/remoteEntry.js"
    standaloneBuild: "standalone"
  dependsOn: ["identity"]
  databases: ["postgres"]
```

Create `platform/project.manifest.yaml` exactly (R1: `surface` carries the shell app recipe; `platformServices` and `reservedPorts` are the pinned data):

```yaml
id: platform
displayName: Supportfolio platform
platformServices:
  - id: postgres
    kind: compose
    composeFile: projects/tinyurl/docker-compose.yml
    serviceName: postgres
    port: 5432
  - id: identity
    kind: gradle
    gradleModule: platform:identity
    port: 8081
    managementPort: 9092
    healthPath: /actuator/health
  - id: shell
    kind: gradle
    gradleModule: platform:shell
    port: 8080
    managementPort: 9091
    healthPath: /actuator/health
  - id: telemetry
    kind: compose-profile
    profile: observability
surface:
  local:
    frontend:
      nxProject: shell-host
      devPort: 4200
      devRemoteEntry: http://localhost:4200/remoteEntry.js
    dependsOn: [identity, tinyurl, telemetry]
reservedPorts:
  - { port: 4200, owner: shell-host }
  - { port: 4201, owner: tinyurl-microfrontend }
  - { port: 8080, owner: shell }
  - { port: 8081, owner: identity }
  - { port: 8082, owner: tinyurl-service }
  - { port: 8083, owner: spare }
  - { port: 5432, owner: postgres }
  - { port: 9091, owner: shell-management }
  - { port: 9092, owner: identity-management }
  - { port: 9093, owner: tinyurl-service-management }
  - { port: 18080, owner: shell-demo }
  - { port: 18082, owner: tinyurl-standalone }
  - { port: 19090, owner: prometheus }
  - { port: 13000, owner: grafana }
```

- [ ] **Step 5: Run the specs again**

Run: `npx jest --selectProjects tools --testPathPattern validate-manifest`
Expected: all tests pass, including the 3 new ones.

- [ ] **Step 6: Run the whole tools project (fixture fallout check)**

Run: `npx jest --selectProjects tools`
Expected: green. If a pre-existing fixture now fails `additionalProperties`, fix that fixture's *values* (remove the stray key) — never relax the schema invariants.

- [ ] **Step 7: Commit**

Run: `git add platform/harness/manifest-schema/project.manifest.schema.json projects/tinyurl/project.manifest.yaml platform/project.manifest.yaml tools/validate-manifest.spec.ts tools/fixtures/valid-manifest-local.yaml tools/fixtures/invalid-manifest-local-typo.yaml`
Run: `git commit -m "feat(manifest): add local recipe section, platform manifest and openUrl to schema"`

---

## Task 2: manifests + closure + ports libraries

**Files**
- Create: `tools/dev-orchestrator/manifests.ts`
- Create: `tools/dev-orchestrator/closure.ts`
- Create: `tools/dev-orchestrator/ports.ts`
- Create: `tools/dev-orchestrator/manifests.spec.ts`
- Create: `tools/dev-orchestrator/closure.spec.ts`
- Create: `tools/dev-orchestrator/ports.spec.ts`

**Interfaces**
- Produces (exact, later tasks rely on these):
```ts
export interface LocalService { gradleModule: string; port: number; healthPath?: string; envFile?: string; }
export interface LocalFrontend { nxProject: string; devPort: number; devRemoteEntry: string; standaloneBuild?: string; }
export interface LocalSection { service?: LocalService; frontend?: LocalFrontend; dependsOn: string[]; databases?: string[]; }
export interface ExposedModule { name: string; version: string; remoteEntry: string; }
export interface ProjectManifest {
  id: string; displayName: string; shortDescription?: string; features?: string[];
  openUrl?: string; exposedModules?: ExposedModule[]; local?: LocalSection;
}
export interface PlatformService {
  id: string; kind: 'compose' | 'compose-profile' | 'gradle';
  gradleModule?: string; port?: number; managementPort?: number; healthPath?: string;
  composeFile?: string; serviceName?: string; profile?: string;
}
export interface PlatformManifest {
  id: string; displayName: string;
  platformServices: PlatformService[];
  reservedPorts: { port: number; owner: string }[];
  surface?: { local: LocalSection };
}
export function loadProjectManifests(root: string): ProjectManifest[]
export function loadPlatformManifest(path: string): PlatformManifest
export function shellAppFromManifest(platform: PlatformManifest): ProjectManifest
export function resolveOrder(appId: string, manifests: ProjectManifest[], platform: PlatformManifest): string[]
export function collectPlannedPorts(order: string[], manifests: ProjectManifest[], platform: PlatformManifest): number[]
export function findPortConflicts(planned: number[]): { port: number; owner: string }[]
export function checkPortsFree(ports: number[]): Promise<{ port: number; busy: true }[]>
```
- `loadProjectManifests` globs `projects/*/project.manifest.yaml` with `js-yaml` `load`, throws on `validateAllManifests` errors; `loadPlatformManifest` parses with `js-yaml` only (R1). `shellAppFromManifest` returns `{ id: 'shell', displayName: platform.displayName, local: platform.surface?.local }` and throws `Error('platform manifest has no surface.local')` when absent. `loadProjectManifests` does **not** include the shell app.
- `resolveOrder` = DFS from `appId`, visiting `local.dependsOn` in order then `local.databases`, emitting each id once, app last. Errors: `Error(\`manifest "${x}" depends on unknown id "${y}"\`)`, `Error(\`dependency cycle: ${a} -> ${b} -> ${a}\`)`. A dep id resolves from a project manifest, or from `platformServices`, or (only for `shell`) from `surface.local`.

- [ ] **Step 1: Write the failing specs**

`tools/dev-orchestrator/closure.spec.ts`:

```ts
expect(resolveOrder('tinyurl', [tinyurl], platform)).toEqual(['identity', 'postgres', 'tinyurl']);
expect(resolveOrder('shell', [tinyurl, shell], platform)).toEqual(['identity', 'postgres', 'tinyurl', 'telemetry', 'shell']);
expect(resolveOrder('tinyurl', [tinyurl], platform)).not.toContain('telemetry');
expect(() => resolveOrder('tinyurl', [brokenUnknown], platform)).toThrow('manifest "tinyurl" depends on unknown id "nope"');
expect(() => resolveOrder('a', [cyclicA, cyclicB], platform)).toThrow('dependency cycle: a -> b -> a');
```

`tools/dev-orchestrator/manifests.spec.ts`:

```ts
const root = join(__dirname, '..', '..');
const manifests = loadProjectManifests(root);
expect(manifests.find(m => m.id === 'tinyurl')?.local?.service?.port).toBe(8082);
expect(manifests.find(m => m.id === 'tinyurl')?.local?.frontend?.devPort).toBe(4201);
const platform = loadPlatformManifest(join(root, 'platform', 'project.manifest.yaml'));
expect(platform.platformServices.map(s => s.id)).toEqual(['postgres', 'identity', 'shell', 'telemetry']);
expect(platform.reservedPorts).toHaveLength(14);
expect(shellAppFromManifest(platform).local?.frontend?.nxProject).toBe('shell-host');
// invalid manifest fixture dir: mkdtemp + a manifest with a typo'd local key → toThrow(/project\.manifest\.yaml/)
```

`tools/dev-orchestrator/ports.spec.ts`:

```ts
expect(collectPlannedPorts(['identity', 'postgres', 'tinyurl', 'telemetry', 'shell'], [tinyurl, shell], platform))
  .toEqual([8081, 9092, 5432, 8082, 9093, 4201, 8080, 9091, 4200]);
expect(findPortConflicts([8081, 8081])).toEqual([{ port: 8081, owner: 'identity' }]);
const server = net.createServer().listen(0);
const busyPort = (server.address() as net.AddressInfo).port;
await expect(checkPortsFree([busyPort])).resolves.toEqual([{ port: busyPort, busy: true }]);
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx jest --selectProjects tools --testPathPattern "closure|manifests|ports"`
Expected: 3 suites fail with `Cannot find module './closure'` / `'./manifests'` / `'./ports'` (module-not-found), plus TS error `TS2307`.

- [ ] **Step 3: Implement the three libraries**

`manifests.ts`: `fs.readdirSync(join(root, 'projects'))` → keep dirs that contain `project.manifest.yaml`; parse each with `yaml.load`; call `validateAllManifests(join(root, 'projects'))` and throw `Error(JSON.stringify(errors))` when any `valid === false`. `shellAppFromManifest` per the interface note. `loadPlatformManifest` = `yaml.load(readFileSync(path,'utf8')) as PlatformManifest`, throwing `Error('platform manifest missing platformServices')` when absent.

`closure.ts`: `depsOf(id)` = `local.dependsOn` concat `local.databases ?? []` for a project id, `[]` for a platform service id; unknown ids throw the exact message; a `visiting` set produces the cycle message with the path joined by `' -> '` and closed with the repeated first id.

`ports.ts`: `collectPlannedPorts` pushes `port` then `managementPort` (skipping undefined) for platform ids, and `local.service.port` then `local.service.managementPort` then `local.frontend.devPort` for project ids. `findPortConflicts` returns duplicates once each, owner resolved from `platform.reservedPorts` (fallback `'plan'`). `checkPortsFree` = for each port, `net.createServer().once('error', …).listen(port)` → `busy: true` on `EADDRINUSE`, else `close()` and continue; returns only busy entries.

- [ ] **Step 4: Run the specs again**

Run: `npx jest --selectProjects tools --testPathPattern "closure|manifests|ports"`
Expected: 3 suites pass, 0 failures.

- [ ] **Step 5: Commit**

Run: `git add tools/dev-orchestrator/manifests.ts tools/dev-orchestrator/closure.ts tools/dev-orchestrator/ports.ts tools/dev-orchestrator/manifests.spec.ts tools/dev-orchestrator/closure.spec.ts tools/dev-orchestrator/ports.spec.ts`
Run: `git commit -m "feat(tools): load manifests, resolve dependency closure, probe planned ports"`

---

## Task 3: registry + trusted-origin generator

**Files**
- Create: `tools/dev-orchestrator/registry.ts`
- Create: `tools/dev-orchestrator/registry.spec.ts`

**Interfaces**
- Produces:
```ts
export function generateDevRegistry(manifests: ProjectManifest[]): string
export function trustedOriginsFor(manifests: ProjectManifest[]): string
```
- `generateDevRegistry` returns `JSON.stringify(envelope, null, 2) + '\n'`; `envelope.projects` is sorted by `id`; each entry is the FULL catalog DTO the shell consumes — `{ id, displayName, shortDescription, features, openUrl, exposedModules: [{ name, version, remoteEntry }] }` — copied from the manifest's own fields (its `openUrl`/`exposedModules` already hold the dev URLs), with `remoteEntry` falling back to `local.frontend.devRemoteEntry` when the manifest has no exposed module. The envelope's top-level key set must equal the committed `platform/shell/config/remote-registry.json`'s key set (R2: read that file, never write it). `trustedOriginsFor` returns unique `http://localhost:<devPort>` for every manifest with `local.frontend.devPort`, joined by `,` in sorted-`id` order.

- [ ] **Step 1: Write the failing spec**

```ts
const out = generateDevRegistry([shell, tinyurl]);
expect(out).toBe(generateDevRegistry([shell, tinyurl]));            // deterministic
expect(out.endsWith('\n')).toBe(true);
const parsed = JSON.parse(out);
expect(Object.keys(parsed)).toEqual(Object.keys(JSON.parse(readFileSync(REGISTRY, 'utf8'))));
expect(parsed.projects.map((p: { id: string }) => p.id)).toEqual(['shell', 'tinyurl']);
const committed = JSON.parse(readFileSync(REGISTRY, 'utf8'));
expect(Object.keys(parsed.projects[1])).toEqual(Object.keys(committed.projects[0]));
expect(parsed.projects[1].exposedModules[0]).toEqual(
  expect.objectContaining({ name: 'card', remoteEntry: 'http://localhost:4201/remoteEntry.js' }));
expect(trustedOriginsFor([shell, tinyurl])).toBe('http://localhost:4200,http://localhost:4201');
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx jest --selectProjects tools --testPathPattern registry`
Expected: fails with `Cannot find module './registry'`.

- [ ] **Step 3: Implement `registry.ts`**

Read the committed registry once at module scope only inside the spec (the implementation must not read it); the implementation emits `{ projects: [...] }` unless the spec's key-set assertion says otherwise — if the committed envelope has extra top-level keys, mirror them with empty values. Sort with `(a, b) => a.id.localeCompare(b.id)`.

- [ ] **Step 4: Run it again**

Run: `npx jest --selectProjects tools --testPathPattern registry`
Expected: passes.

- [ ] **Step 5: Commit**

Run: `git add tools/dev-orchestrator/registry.ts tools/dev-orchestrator/registry.spec.ts`
Run: `git commit -m "feat(tools): generate the dev remote registry and trusted origins from manifests"`

---

## Task 4: process plan builder

**Files**
- Create: `tools/dev-orchestrator/plan.ts`
- Create: `tools/dev-orchestrator/plan.spec.ts`

**Interfaces**
- Produces:
```ts
export interface ProcessSpec { name: string; color: string; command: string; }
export interface ResolvedPlan { processes: ProcessSpec[]; env: Record<string, string>; registryPath: string; }
export function buildProcessPlan(mode: 'serve' | 'build-watch', app: ProjectManifest, manifests: ProjectManifest[], platform: PlatformManifest, repoRoot: string): ResolvedPlan
```
- Derivation (generic — no per-app branches beyond `id === app.id` for the SPA owner):
  - `order = resolveOrder(app.id, manifests, platform)`; iterate `order` and, for each id, emit its service process and then immediately its frontend process (the frontend is never separated from its owner):
    `kind: 'gradle'` → `<waitOn>gradlew.bat <gradleModule>:bootRun --console=plain`; `kind: 'compose'` → `docker compose -p supportfolio-dev -f <composeFile> up -d --wait <serviceName>`; `kind: 'compose-profile'` → `docker compose -p supportfolio-dev -f docker-compose.demo.yml -f docker-compose.dev.yml --profile <profile> up -d --wait --no-deps prometheus grafana`; a project id with `local.frontend` → `npx nx serve <nxProject>` (serve) or `npx nx build <nxProject> --watch` (build-watch).
  - `<waitOn>` = `wait-on -t 120000 <urls> && ` where `<urls>` = `http-get://localhost:<managementPort ?? port><healthPath>` for each id in the app's `dependsOn`/`databases` (transitive closure, not just direct) that declares a `healthPath` — **managementPort, never the public port: actuator lives only on the management port and is not served on 8081/8082/8080** — plus `tcp:127.0.0.1:5432` when `postgres` is in the closure; empty when there are no urls (identity) — then no `wait-on` prefix at all.
  - names/colors: `postgres`=gray, `telemetry`=cyan, `identity`=green, `shell`=blue, `tinyurl-service`=magenta, frontends=yellow. Process name for a project service = its manifest `id` + `-service` when `id !== 'shell'` (i.e. `tinyurl-service`), for a frontend = its `nxProject`.
  - `registryPath` = `join(repoRoot, 'platform', 'shell', 'config', 'remote-registry.dev.json')`.
  - `env` = parsed `<repoRoot>/.env` (empty object when the file is absent), plus:
    `SUPPORTFOLIO_IDENTITY_JWT_PRIVATE_KEY_FILE = join(repoRoot,'platform','identity','dev-key.pem')`,
    `SPRING_DEVTOOLS_LIVERELOAD_ENABLED = 'false'`,
    `SUPPORTFOLIO_SHELL_REMOTE_REGISTRY_FILE = registryPath`,
    `SUPPORTFOLIO_SHELL_TRUSTED_REMOTE_ORIGINS = trustedOriginsFor(manifests)`,
    and only in `build-watch`: `SPRING_WEB_RESOURCES_STATIC_LOCATIONS = 'file:' + join(repoRoot, 'dist', <outputPath>, '')` where `<outputPath>` = `platform/shell/host` for app `shell`, `projects/tinyurl/microfrontend` for app `tinyurl`.

- [ ] **Step 1: Write the failing spec (full lists, not slices)**

```ts
const root = 'C:\\repo';                       // fake repoRoot
const plan = buildProcessPlan('serve', shellApp, [tinyurl, shellApp], platform, root);
expect(plan.processes.map(p => p.name)).toEqual([
  'identity', 'postgres', 'tinyurl-service', 'tinyurl-microfrontend', 'telemetry', 'shell', 'shell-host',
]);
expect(plan.processes.map(p => p.command)).toEqual([
  'gradlew.bat :platform:identity:bootRun --console=plain',
  'docker compose -p supportfolio-dev -f projects/tinyurl/docker-compose.yml up -d --wait postgres',
  'wait-on -t 120000 http-get://localhost:9092/actuator/health tcp:127.0.0.1:5432 && gradlew.bat :projects:tinyurl:service:bootRun --console=plain',
  'npx nx serve tinyurl-microfrontend',
  'docker compose -p supportfolio-dev -f docker-compose.demo.yml -f docker-compose.dev.yml --profile observability up -d --wait --no-deps prometheus grafana',
  'wait-on -t 120000 http-get://localhost:9092/actuator/health http-get://localhost:9093/actuator/health tcp:127.0.0.1:5432 && gradlew.bat :platform:shell:bootRun --console=plain',
  'npx nx serve shell-host',
]);
expect(plan.processes.map(p => p.color)).toEqual(['green', 'gray', 'magenta', 'yellow', 'cyan', 'blue', 'yellow']);
expect(plan.env.SPRING_DEVTOOLS_LIVERELOAD_ENABLED).toBe('false');
expect(plan.env.SPRING_WEB_RESOURCES_STATIC_LOCATIONS).toBeUndefined();
expect(path.isAbsolute(plan.env.SUPPORTFOLIO_SHELL_REMOTE_REGISTRY_FILE)).toBe(true);
expect(path.isAbsolute(plan.env.SUPPORTFOLIO_IDENTITY_JWT_PRIVATE_KEY_FILE)).toBe(true);
expect(plan.env.SUPPORTFOLIO_SHELL_TRUSTED_REMOTE_ORIGINS).toBe('http://localhost:4200,http://localhost:4201');
```

Same file, three more cases: (`serve`, tinyurl) → 4 processes `['identity','postgres','tinyurl-service','tinyurl-microfrontend']`; (`build-watch`, shell) → same names, last two commands `npx nx build tinyurl-microfrontend --watch` / `npx nx build shell-host --watch`, `path.isAbsolute(env.SPRING_WEB_RESOURCES_STATIC_LOCATIONS.slice('file:'.length))` true and ending `dist\\platform\\shell\\host\\`; (`build-watch`, tinyurl) → static locations ending `dist\\projects\\tinyurl\\microfrontend\\`.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx jest --selectProjects tools --testPathPattern plan`
Expected: `Cannot find module './plan'`.

- [ ] **Step 3: Implement `plan.ts`**

Implement exactly the derivation above; parse `.env` with `split('\n')` → `line.trim()` → skip empty/`#` → split on the first `=`. Use `path.join` for every path so the fake `C:\repo` root absolute-checks pass.

- [ ] **Step 4: Run the spec again**

Run: `npx jest --selectProjects tools --testPathPattern plan`
Expected: passes, 4 test cases.

- [ ] **Step 5: Commit**

Run: `git add tools/dev-orchestrator/plan.ts tools/dev-orchestrator/plan.spec.ts`
Run: `git commit -m "feat(tools): resolve the process plan, env map and absolute paths per app and mode"`

---

## Task 5: CLI, preflight and spawner

**Files**
- Create: `tools/dev-orchestrator.ts`
- Create: `tools/dev-orchestrator.spec.ts`

**Interfaces**
- Produces:
```ts
export function parseArgs(argv: string[]): { command: 'plan' | 'watch'; app?: string; buildWatch: boolean }
export async function runPreflight(plan: ResolvedPlan, env: Record<string, string>): Promise<void>
```
- `parseArgs`: `argv[0]` must be `plan` or `watch`, `argv[1]` optional app id, `--build-watch` sets `buildWatch`; anything else throws `Error('usage: tsx tools/dev-orchestrator.ts <plan|watch> <app> [--build-watch]')`.
- `runPreflight` throws, in this order: `Error('missing <abs>\\.env — run scripts/dev-secrets.ps1 first')`; `Error('missing <abs>\\platform\\identity\\dev-key.pem — run: openssl genpkey -algorithm RSA -out platform/identity/dev-key.pem -pkeyopt rsa_keygen_bits:2048')` (generates nothing itself); `Error('port <p> is in use (owner: <owner>) — find it with: netstat -ano | findstr :<p>')` for each busy port.
- `main`: `plan` prints `JSON.stringify(plan, null, 2)` and returns 0 without spawning; `watch` runs preflight, writes `plan.registryPath` (mkdir -p first), then `const { concurrently } = await import('concurrently')` and `await concurrently(plan.processes.map(p => ({ command: p.command, name: p.name, prefixColor: p.color })), { killOthersOn: ['failure'], prefix: 'name' })`.

- [ ] **Step 1: Write the failing spec**

```ts
expect(parseArgs(['watch', 'shell'])).toEqual({ command: 'watch', app: 'shell', buildWatch: false });
expect(parseArgs(['watch', 'tinyurl', '--build-watch'])).toEqual({ command: 'watch', app: 'tinyurl', buildWatch: true });
expect(() => parseArgs(['bogus'])).toThrow('usage: tsx tools/dev-orchestrator.ts <plan|watch> <app> [--build-watch]');
await expect(runPreflight(fakePlanWithoutEnvFile, {})).rejects.toThrow(/scripts\/dev-secrets\.ps1/);
await expect(runPreflight(fakePlanWithEnvButNoKey, {})).rejects.toThrow(/openssl genpkey/);
await expect(runPreflight(fakePlanOnBusyPort, {})).rejects.toThrow(/port \d+ is in use/);
```

Plus a spawn test with `jest.mock('concurrently')` asserting `concurrently` was called with 7 `{command,name,prefixColor}` objects and `{ killOthersOn: ['failure'], prefix: 'name' }` (use the fake root from Task 4 and a temp `.env`).

- [ ] **Step 2: Run it and watch it fail**

Run: `npx jest --selectProjects tools --testPathPattern dev-orchestrator`
Expected: `Cannot find module './tools/dev-orchestrator'` → the spec's `import … from './dev-orchestrator'` fails with `TS2307`.

- [ ] **Step 3: Implement the CLI**

Implement `parseArgs`, `runPreflight`, `main` per the interface. `main` prints the thrown message to `stderr` and returns `1`. Guard CLI-only execution the same way `tools/prod-bundle-gate.ts` guards its own CLI entry (copy its pattern verbatim — do not use `require.main === module` if the repo's established pattern differs).

- [ ] **Step 4: Run it again, then the whole tools project**

Run: `npx jest --selectProjects tools --testPathPattern dev-orchestrator`
Expected: passes (parseArgs 3 cases, preflight 3 cases, spawn 1 case).
Run: `npx jest --selectProjects tools`
Expected: green, 0 failures.

- [ ] **Step 5: Commit**

Run: `git add tools/dev-orchestrator.ts tools/dev-orchestrator.spec.ts`
Run: `git commit -m "feat(tools): add dev orchestrator CLI with preflight, plan output and concurrently spawn"`

---

## Task 6: Gradle DevTools on the three services

**Files**
- Modify: `platform/identity/build.gradle.kts`
- Modify: `platform/shell/build.gradle.kts`
- Modify: `projects/tinyurl/service/build.gradle.kts`

**Interfaces**
- Produces: `developmentOnly` classpath entry only (no runtime API).

- [ ] **Step 1: Confirm the current state (failing baseline)**

Run: `.\gradlew.bat :platform:identity:dependencies --configuration developmentOnly`
Expected: fails with `Configuration 'developmentOnly' not found` (or lists no devtools) — the gate for this task.

- [ ] **Step 2: Add the dependency to all three modules**

Add below the existing `dependencies { … }` entries in each of the three `build.gradle.kts`:

```kotlin
// DevTools is BOM-managed by Boot 4.1.1; developmentOnly keeps it out of prod images.
developmentOnly("org.springframework.boot:spring-boot-devtools")
```

- [ ] **Step 3: Verify the configuration resolves**

Run: `.\gradlew.bat :platform:identity:dependencies --configuration developmentOnly`
Expected: output contains `org.springframework.boot:spring-boot-devtools`.
Run: `.\gradlew.bat :platform:shell:dependencies --configuration developmentOnly`
Run: `.\gradlew.bat :projects:tinyurl:service:dependencies --configuration developmentOnly`
Expected: same line in both.

- [ ] **Step 4: Verify the builds stay green**

Run: `.\gradlew.bat :platform:identity:build :platform:shell:build :projects:tinyurl:service:build`
Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 5: Commit**

Run: `git add platform/identity/build.gradle.kts platform/shell/build.gradle.kts projects/tinyurl/service/build.gradle.kts`
Run: `git commit -m "chore(build): add spring-boot-devtools as developmentOnly to identity, shell and tinyurl service"`

---

## Task 7: standalone build configuration for tinyurl

**Files**
- Modify: `projects/tinyurl/microfrontend/project.json`
- Create: `projects/tinyurl/microfrontend/src/environments/environment.standalone.ts`
- Create: `projects/tinyurl/microfrontend/src/environments/environment.standalone.spec.ts`

**Interfaces**
- Produces: Nx configuration name `standalone` on `tinyurl-microfrontend:build`, output `dist/projects/tinyurl/microfrontend-standalone` (consumed by `docker-compose.standalone.yml` in Task 8 and `prod.ps1` in Task 11).

- [ ] **Step 1: Write the failing environment spec**

Create `environment.standalone.spec.ts` mirroring `environment.prod.spec.ts`'s pattern:

```ts
import { environment } from './environment.standalone';

describe('standalone environment', () => {
  it('is production and same-origin', () => {
    expect(environment.production).toBe(true);
    expect(environment.apiBaseUrl).toBe('');
    expect(environment.identityLoginBaseUrl).toBe('');
    expect(environment.publicBaseUrl).toBe('');
    expect(environment.linkApiBaseUrl).toBe('');
    expect(environment.callbackPath).toBe('/auth/callback');
    expect(environment.apiUrlPrefixes).toEqual(['/api/']);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx jest --selectProjects tinyurl-microfrontend --testPathPattern environment.standalone`
Expected: fails — `Cannot find module './environment.standalone'`.

- [ ] **Step 3: Create the environment (exact content) and the build configuration**

`projects/tinyurl/microfrontend/src/environments/environment.standalone.ts`:

```ts
/** Standalone prod: the service serves this bundle at its own origin; everything is same-origin. */
export const environment = {
  production: true,
  apiBaseUrl: '',
  identityLoginBaseUrl: '',
  publicBaseUrl: '',
  linkApiBaseUrl: '',
  callbackPath: '/auth/callback',
  apiUrlPrefixes: ['/api/'],
};

export default environment;
```

In `projects/tinyurl/microfrontend/project.json` add a sibling of `production` under `targets.build.configurations`:

```json
"standalone": {
  "baseHref": "/",
  "budgets": [
    { "type": "initial", "maximumWarning": "500kb", "maximumError": "1mb" },
    { "type": "anyComponentStyle", "maximumWarning": "4kb", "maximumError": "8kb" }
  ],
  "outputHashing": "all",
  "outputPath": "dist/projects/tinyurl/microfrontend-standalone",
  "customWebpackConfig": { "path": "projects/tinyurl/microfrontend/webpack.prod.config.js" },
  "fileReplacements": [
    {
      "replace": "projects/tinyurl/microfrontend/src/environments/environment.ts",
      "with": "projects/tinyurl/microfrontend/src/environments/environment.standalone.ts"
    }
  ]
}
```

- [ ] **Step 4: Run the spec again**

Run: `npx jest --selectProjects tinyurl-microfrontend --testPathPattern environment.standalone`
Expected: passes.

- [ ] **Step 5: Build and gate the standalone bundle**

Run: `npx nx build tinyurl-microfrontend --configuration=standalone`
Expected: `Successfully ran target build`; `dist/projects/tinyurl/microfrontend-standalone/index.html` exists.
Run: `npx tsx tools/prod-bundle-gate.ts dist/projects/tinyurl/microfrontend-standalone`
Expected: exit 0, no `dev identity URL` finding.

- [ ] **Step 6: Prove the default production build is unchanged**

Run: `npx nx build tinyurl-microfrontend`
Run: `npx tsx tools/prod-bundle-gate.ts dist/projects/tinyurl/microfrontend`
Expected: build succeeds and the gate exits 0.

- [ ] **Step 7: Commit**

Run: `git add projects/tinyurl/microfrontend/project.json projects/tinyurl/microfrontend/src/environments/environment.standalone.ts projects/tinyurl/microfrontend/src/environments/environment.standalone.spec.ts`
Run: `git commit -m "feat(tinyurl): add standalone Nx build configuration and same-origin environment"`

---

## Task 8: compose overrides + dev Prometheus

**Files**
- Create: `docker-compose.standalone.yml`
- Create: `docker-compose.dev.yml`
- Create: `observability/prometheus/prometheus.dev.yml`

**Interfaces**
- Produces: compose file paths consumed by `plan.ts` (`-f docker-compose.dev.yml`) and `prod.ps1` (`-f docker-compose.standalone.yml`).

- [ ] **Step 1: Create the standalone override (exact)**

```yaml
# Standalone TinyURL: no shell. Publishes the service and identity's redirect origin,
# and shadows the composed bundle with the locally built standalone one.
services:
  tinyurl-service:
    ports:
      - "127.0.0.1:18082:8082"
    volumes:
      - ./dist/projects/tinyurl/microfrontend-standalone:/app/static:ro

  identity:
    environment:
      SUPPORTFOLIO_IDENTITY_REDIRECT_ORIGINS: http://localhost:18080,http://localhost:18082
```

- [ ] **Step 2: Create the dev telemetry override (exact)**

```yaml
# Dev telemetry: scrape the host-side services instead of Docker service names.
services:
  prometheus:
    extra_hosts:
      - "host.docker.internal:host-gateway"
    volumes:
      - ./observability/prometheus/prometheus.dev.yml:/etc/prometheus/prometheus.dev.yml:ro
    command:
      - --config.file=/etc/prometheus/prometheus.dev.yml
      - --storage.tsdb.path=/prometheus
      - --web.listen-address=0.0.0.0:9090
```

- [ ] **Step 3: Create the dev scrape config**

Copy `observability/prometheus/prometheus.yml` to `observability/prometheus/prometheus.dev.yml` unchanged except every `targets:` entry, which becomes (in the existing job order — shell, identity, tinyurl):

```yaml
      - targets: ["host.docker.internal:9091"]
      - targets: ["host.docker.internal:9092"]
      - targets: ["host.docker.internal:9093"]
```

Job names stay `supportfolio-shell`, `supportfolio-identity`, `supportfolio-tinyurl` (Task 12's target assertion uses the `supportfolio-` prefix).

- [ ] **Step 4: Validate both composes**

Run: `docker compose -f docker-compose.demo.yml -f docker-compose.standalone.yml config`
Expected: exit 0; the rendered `tinyurl-service` shows `published: "18082"` and the `./dist/projects/tinyurl/microfrontend-standalone` bind, `identity` shows both redirect origins.
Run: `docker compose -f docker-compose.demo.yml -f docker-compose.dev.yml --profile observability config`
Expected: exit 0; `prometheus` shows `host.docker.internal:host-gateway`.

- [ ] **Step 5: Commit**

Run: `git add docker-compose.standalone.yml docker-compose.dev.yml observability/prometheus/prometheus.dev.yml`
Run: `git commit -m "feat(compose): add standalone and dev-telemetry overrides with host-side scrape config"`

---

## Task 9: package.json scripts + devDependencies

**Files**
- Modify: `package.json`
- Modify: `package-lock.json` (via npm)

**Interfaces**
- Produces: the seven npm entry points (`watch:shell`, `watch:tinyurl`, `build-watch:shell`, `build-watch:tinyurl`, `start:plan`, `prod:shell`, `prod:tinyurl`, `stop`) used by Task 12 and both READMEs.

- [ ] **Step 1: Add the devDependencies**

Run: `npm i -D concurrently wait-on`
Expected: `package.json` gains both under `devDependencies`; `package-lock.json` changes; `added N packages`.

- [ ] **Step 2: Add the scripts (keep `run:all` untouched)**

```json
"watch:shell": "npx tsx tools/dev-orchestrator.ts watch shell",
"watch:tinyurl": "npx tsx tools/dev-orchestrator.ts watch tinyurl",
"build-watch:shell": "npx tsx tools/dev-orchestrator.ts watch shell --build-watch",
"build-watch:tinyurl": "npx tsx tools/dev-orchestrator.ts watch tinyurl --build-watch",
"start:plan": "npx tsx tools/dev-orchestrator.ts plan shell",
"prod:shell": "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/prod.ps1 -App shell",
"prod:tinyurl": "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/prod.ps1 -App tinyurl",
"stop": "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/stop.ps1"
```

- [ ] **Step 3: Verify the wiring**

Run: `npx tsx tools/dev-orchestrator.ts plan shell`
Expected: prints the `ResolvedPlan` JSON with 7 processes and the absolute `registryPath`. (Processes are not spawned.)
Run: `npm run`
Expected: lists `watch:shell`, `watch:tinyurl`, `build-watch:shell`, `build-watch:tinyurl`, `start:plan`, `prod:shell`, `prod:tinyurl`, `stop`, `run:all`.

- [ ] **Step 4: Commit**

Run: `git add package.json package-lock.json`
Run: `git commit -m "chore(npm): add one-command start scripts and concurrently/wait-on devDependencies"`

---

## Task 10: stop.ps1, dev-secrets.ps1, .env.example, .gitignore

**Files**
- Create: `scripts/stop.ps1`
- Create: `scripts/dev-secrets.ps1`
- Create: `.env.example`
- Modify: `.gitignore`

**Interfaces**
- Produces: `scripts/stop.ps1` and `scripts/dev-secrets.ps1` (called by `npm run stop` and by hand); `.env` at the repo root read by `plan.ts`.

- [ ] **Step 1: Create `.env.example` (exact)**

```
# Copy to .env and fill in. .env is git-ignored; never commit real values.
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
SUPPORTFOLIO_IDENTITY_ISSUER=http://localhost:8081
SUPPORTFOLIO_IDENTITY_ADMIN_LOGIN=
SUPPORTFOLIO_IDENTITY_ALLOWLIST=
SUPPORTFOLIO_IDENTITY_REDIRECT_ORIGINS=http://localhost:4200,http://localhost:4201,http://localhost:8082,http://localhost:18082
# Filled in by scripts/dev-secrets.ps1 (absolute path to platform/identity/dev-key.pem):
SUPPORTFOLIO_IDENTITY_JWT_PRIVATE_KEY_FILE=
```

- [ ] **Step 2: Create `scripts/dev-secrets.ps1`**

Behavior, in order: resolve `$root = Split-Path -Parent $PSScriptRoot`; if `$root\.env` is missing, copy `$root\.env.example` to it and print `created .env from .env.example`; if `$root\platform\identity\dev-key.pem` is missing, run `openssl genpkey -algorithm RSA -out <abs key path> -pkeyopt rsa_keygen_bits:2048` and fail with `openssl is required to generate platform/identity/dev-key.pem` when the command is absent; rewrite the `SUPPORTFOLIO_IDENTITY_JWT_PRIVATE_KEY_FILE=` line in `.env` to the **absolute** key path; print `SUPPORTFOLIO_IDENTITY_JWT_PRIVATE_KEY_FILE set`.

- [ ] **Step 3: Create `scripts/stop.ps1`**

Behavior: `param([switch]$Volumes)`; run `.\gradlew.bat --stop` from `$root`; for each of `4200,4201,8080,8081,8082,9091,9092,9093` query `Get-NetTCPConnection -LocalPort $_ -State Listen -ErrorAction SilentlyContinue`, take the distinct `OwningProcess`, run `Stop-Process -Id <pid> -Force -ErrorAction SilentlyContinue`, and print `<port> -> killed PID <pid>` (skip and print `<port> -> free` when none); then run `docker compose -p supportfolio-dev down --remove-orphans` (append `-v` when `-Volumes`); print `dev stack stopped`.

- [ ] **Step 4: Ignore the generated registry and the scratch dir**

Append to `.gitignore`:

```
# Generated per-run by tools/dev-orchestrator.ts
platform/shell/config/remote-registry.dev.json
# Local scratch (env files if ever added, logs, dumps)
.dev/
```

- [ ] **Step 5: Verify the ignores**

Run: `git check-ignore platform/shell/config/remote-registry.dev.json .env .dev/x`
Expected: exit 0, three paths printed.

- [ ] **Step 6: Verify stop.ps1 parses**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Command -Syntax ./scripts/stop.ps1"`
Expected: prints the syntax line including `[-Volumes]`, no parse error.

- [ ] **Step 7: Commit**

Run: `git add scripts/stop.ps1 scripts/dev-secrets.ps1 .env.example .gitignore`
Run: `git commit -m "chore(scripts): add stop and dev-secrets scripts plus ignored dev registry"`

---

## Task 11: prod.ps1

**Files**
- Create: `scripts/prod.ps1`

**Interfaces**
- Produces: `scripts/prod.ps1 -App shell|tinyurl` (invoked by `prod:shell`/`prod:tinyurl`).

- [ ] **Step 1: Write the script shell and confirm the failure mode**

Implementation requirements, mirroring `scripts/demo.ps1`'s structure (no tunnel, no `docker compose down -v`):

- `param([ValidateSet('shell','tinyurl')][string]$App)`; when `$App` is empty print
  `usage: scripts/prod.ps1 -App shell|tinyurl` and `exit 1`.
- `$ErrorActionPreference = 'Stop'`; resolve `$root`.
- `shell` branch: `.\gradlew.bat bootJar` for `:platform:identity`, `:platform:shell`, `:projects:tinyurl:service`; `npx nx build shell-host` and `npx nx build tinyurl-microfrontend`; `docker build` for the three images exactly as `scripts/demo.ps1` builds them (reuse its `-f`/`-t` arguments verbatim); `docker compose -f docker-compose.demo.yml --profile observability up -d --wait shell prometheus grafana`; print `shell  http://localhost:18080`, `grafana http://localhost:13000`, `prometheus http://localhost:19090` and `reset: docker compose -f docker-compose.demo.yml --profile observability down -v`.
- `tinyurl` branch: `.\gradlew.bat :platform:identity:bootJar :projects:tinyurl:service:bootJar`; `npx nx build tinyurl-microfrontend --configuration=standalone`; `docker build` identity and tinyurl images only (same tags as `demo.ps1`); `docker compose -f docker-compose.demo.yml -f docker-compose.standalone.yml up -d --wait tinyurl-service`; print `tinyurl http://localhost:18082` and `reset: docker compose -f docker-compose.demo.yml -f docker-compose.standalone.yml down -v`.

- [ ] **Step 2: Verify the usage branch**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/prod.ps1; echo "exit=$LASTEXITCODE"`
Expected: prints `usage: scripts/prod.ps1 -App shell|tinyurl` and `exit=1`.

- [ ] **Step 3: Verify the switch is wired**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -Command "(Get-Command ./scripts/prod.ps1).Parameters.Keys -join ','"`
Expected: output contains `App`.

- [ ] **Step 4: Commit**

Run: `git add scripts/prod.ps1`
Run: `git commit -m "feat(scripts): add prod.ps1 for composed shell and standalone tinyurl stacks"`

---

## Task 12: runtime verification + docs

**Files**
- Modify: `platform/shell/README.md`
- Modify: `projects/tinyurl/README.md`

**Interfaces**
- Consumes: everything above.

- [ ] **Step 1: Dev loop end to end**

Run: `npm run watch:shell`
Expected: 7 processes with coloured prefixes; identity then postgres then tinyurl-service then the two dev servers then telemetry then shell come up; no `EADDRINUSE` and no `wait-on` timeout.

Run: `curl.exe -f http://localhost:8080/api/remote-registry`
Expected: exit 0; the body contains `http://localhost:4201/remoteEntry.js`.
Run: `curl.exe -f http://localhost:8081/oauth2/jwks`
Expected: exit 0, JSON with `keys`.
Run: `curl.exe -f http://localhost:4200`
Expected: exit 0, the host shell HTML.
Run: `curl.exe -f http://localhost:19090/api/v1/targets`
Expected: exit 0; every target whose job name starts with `supportfolio-` has `"health":"up"` (3 targets).

- [ ] **Step 2: Java reload**

Touch one line in `platform/identity/src/main/java/**` (add and remove a blank line) while `watch:shell` runs.
Expected: the identity process prints `Restarted IdentityApplication in …` within ~10 s; the other processes keep their PIDs.

- [ ] **Step 3: Port preflight gate**

With `watch:shell` still running, run: `npm run start:plan`
Expected (preflight is only on `watch`): prints the plan JSON, exit 0. Then run: `npx tsx tools/dev-orchestrator.ts watch shell`
Expected: exits non-zero with `port 4200 is in use (owner: shell-host) — find it with: netstat -ano | findstr :4200`, and no process is spawned.

- [ ] **Step 4: Stop**

Run: `npm run stop`
Expected: prints `killed PID <n>` lines for the ports it owned, `dev stack stopped`; then `curl.exe http://localhost:8080` fails (exit non-zero) and `docker ps --filter name=supportfolio-dev` lists nothing.

- [ ] **Step 5: Standalone prod**

Run: `npm run prod:tinyurl`
Expected: jars build, the standalone bundle builds, 3 containers reach healthy; prints `tinyurl http://localhost:18082`.
Run: `curl.exe -f http://localhost:18082/actuator/health`
Expected: exit 0, `{"status":"UP"}`.
Run: `curl.exe -f http://localhost:18082/`
Expected: exit 0, the tinyurl index HTML (contains the app's `<app-root>`).
Run: `curl.exe http://localhost:18080`
Expected: non-zero exit — the shell is not running.
Run: `npm run stop`
Expected: containers down.

- [ ] **Step 6: Update `platform/shell/README.md`**

Replace the "Run it (dev)" section with: `npm run watch:shell` (dev servers, 4200 shell-host + 4201 tinyurl-mf), `npm run build-watch:shell` (gateway serves `http://localhost:8080`), `npm run start:plan` (prints the resolved plan, spawns nothing), `npm run stop`. Add the port map block (8080 shell, 8081 identity, 8082 tinyurl-service, 5432 postgres, 9091/9092/9093 management, 19090 prometheus, 13000 grafana). Add literally:

> `watch:*` and `build-watch:*` are mutually exclusive with `npx nx e2e shell-host-e2e`: Playwright's config runs `npx nx serve tinyurl-microfrontend --port 4201 --configuration=development` and `npx nx serve shell-host --port 4200 --configuration=e2e`, so the dev servers must be stopped first.

Add an "Add project #4" recipe: create `projects/<id>/project.manifest.yaml` with a `local:` block (`service`/`frontend`/`dependsOn`/`databases`), then `npm run start:plan` — the dev registry, trusted origins and process list are generated, no orchestrator edit.

- [ ] **Step 7: Update `projects/tinyurl/README.md`**

Same "Run it (dev)" rewrite for `npm run watch:tinyurl` (4201 + 8082) and `npm run build-watch:tinyurl` (the service serves the SPA on `http://localhost:8082`), the note that `watch:tinyurl` has **no** telemetry (its `local.dependsOn` has no `telemetry`), the same e2e/watch exclusivity paragraph, `npm run prod:tinyurl` → `http://localhost:18082` standalone (postgres + identity + tinyurl-service, no shell), and the "Add project #4" recipe.

- [ ] **Step 8: Final gates**

Run: `npx prettier --check "platform/**/*.{ts,html}" "tools/**/*.ts" "eslint.config.mjs" "jest.config.ts" "jest.preset.js"`
Expected: `All matched files use Prettier code style!`
Run: `npx jest --selectProjects tools`
Expected: green, 0 failures.
Run: `.\gradlew.bat build && .\gradlew.bat -p build-logic test` (Docker required for the Testcontainers suite)
Expected: both `BUILD SUCCESSFUL`.
Run: `npx nx run-many -t lint test --projects=shared-ui-lib,shell-host,tinyurl-microfrontend`
Expected: all targets succeed.
Run: `npx nx build shell-host && npx nx build tinyurl-microfrontend`
Expected: both `Successfully ran target build`.

- [ ] **Step 9: Commit**

Run: `git add platform/shell/README.md projects/tinyurl/README.md`
Run: `git commit -m "docs: document the one-command dev/prod workflow and the add-a-project recipe"`

- [ ] **Step 10: Push and open the PR**

Run: `git push -u origin feat/one-command-start`
Run: `gh pr create --base main --title "feat: one-command start for dev and prod" --body "Implements docs/superpowers/specs/2026-11-22-one-command-start-design.md — manifest-driven orchestrator, generated dev registry, DevTools hot reload, standalone tinyurl build."`
Expected: PR URL printed.
