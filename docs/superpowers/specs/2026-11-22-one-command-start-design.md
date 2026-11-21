# One-command start for shell and tinyurl (dev + prod)

Date: 2026-11-22
Status: proposed (v2 — revised after an industry-practice review)

## Intent

Starting the platform today needs six terminals, memorised env vars and several
`docker compose` invocations. Replace that with one command per project and mode, modelled on
the JHipster loop (`watch`, `build-watch`, `concurrently`, Spring Boot DevTools) — but built as
a **manifest-driven aggregator** so that adding project #4 and #5 requires no orchestrator
changes.

## Goals

- One command per project and mode; one Ctrl+C stops the process group.
- Adding a microservice + microfrontend means adding a manifest entry and a registry entry —
  never editing the orchestrator.
- Every service is a first-class standalone application in **both** dev and prod.
- Registry files are generated artifacts, never hand-maintained.

## Non-goals

- No change to the runtime auth/CSP architecture beyond what is listed below.
- No tunnel in the commands; `scripts/demo.ps1` keeps that.
- No Tilt/Skaffold/Aspire adoption — their *model* (per-service recipe + dependency DAG) is
  reproduced natively via the manifests.

## Constraints found in the repo (verified)

1. The registry is a JSON file hot-read by the gateway; `/apps/**` static serving is hardcoded
   to container paths in `AppHostingConfig`, so dev needs absolute `http://localhost:<port>`
   URLs in a generated dev registry.
2. `bootRun` CWD = the module directory — all file paths passed to services must be absolute.
3. Identity has no database and must be up first (issuer discovery + JWKS); Postgres is only
   needed by tinyurl-service.
4. Prometheus scrapes Docker service names; dev needs a `host.docker.internal` variant.
5. TinyURL's production bundle has `baseHref: /apps/tinyurl/` and is served by the shell — the
   integrated-monolith anti-pattern. This design removes it (see Standalone prod).
6. Concurrent Gradle builds in one project do not serialize (verified: `gradlew help` in 3 s
   while `identity:bootRun` was listening on 8081).
7. The manifest schema silently accepts unknown keys and hardcodes a `card` module; the e2e
   Playwright config owns ports 4200/4201; the demo and dev composes share the implicit project
   name `supportfolio`.

## Command surface (unchanged from v1)

```powershell
npm run watch:shell           # HMR dev loop, shell + everything
npm run watch:tinyurl         # HMR dev loop, tinyurl slice
npm run build-watch:shell     # continuous build served by the gateway
npm run build-watch:tinyurl   # continuous build served by the service
npm run prod:shell            # Docker core stack + telemetry, composed mode
npm run prod:tinyurl          # Docker standalone stack: postgres + identity + tinyurl
npm run stop                  # stop dev processes and containers
```

All seven are thin wrappers around `node tools/dev-orchestrator.ts <command> <app>`.
A future `watch:<new-app>` requires only a manifest entry.

## Architecture: the manifest is the source of truth

### Manifest extension (`project.manifest.yaml`)

```yaml
local:
  service:                       # optional — absent for pure-frontend projects
    gradleModule: "projects:tinyurl:service"
    port: 8082
    healthPath: /actuator/health
    envFile: .dev/tinyurl.env    # resolved relative to the module dir (bootRun CWD)
  frontend:                      # optional — absent for pure-backend projects
    nxProject: tinyurl-microfrontend
    devPort: 4201
    devRemoteEntry: http://localhost:4201/remoteEntry.js
    standaloneBuild: standalone  # the build configuration that makes it self-sufficient
  dependsOn: [identity]          # manifest ids; platform ids come from the platform manifest
  databases: [postgres]
```

Schema changes (all verified gaps today): add `local` with `additionalProperties: false` inside
it (and at the top level) so recipe typos fail validation instead of being ignored; drop the
hardcoded `contains: {name: "card"}` so the schema is project-generic; document that
`openUrl`/`remoteEntry` are **dev** shapes and that both registry files are generated.

### Platform manifest (`platform/project.manifest.yaml`, new)

Declares the platform services and the reserved port map (4200, 4201, 8080–8083, 5432,
9091–9093, 18080, 18082, 19090, 13000) so `tools/` tests can detect port collisions and
unknown `dependsOn` references before anything starts.

### The orchestrator (`tools/dev-orchestrator.ts`)

Plain Node/Jest TS, consistent with `tools/` (governance scope), thin npm/PowerShell wrappers:

1. Load manifests for `<app>`; resolve the `dependsOn` closure (topological sort, cycle check).
2. Preflight: dev-key exists (generate via openssl if missing), identity env file present
   (else fail with "run scripts/dev-secrets.ps1 first"), **port map free**, gradle module and
   nx project exist (`gradlew :module:tasks --offline`, `npx nx show projects`).
3. Generate `platform/shell/config/remote-registry.dev.json` from the manifests (dev URLs) and
   compute `SUPPORTFOLIO_SHELL_TRUSTED_REMOTE_ORIGINS` from the same resolved ports — no
   hand-maintained lists, no silent CSP drops for remote #4.
4. Spawn the process list via `concurrently --kill-others-on-fail` with `wait-on` HTTP health
   guards (`--timeout` set so a dead dependency fails fast, never hangs).
5. All env-file paths and key paths are **absolute** (bootRun CWD = module dir).

### Dev registry / CSP generation

`remote-registry.dev.json` is generated; a CI drift gate (generate → diff → fail) protects it.
The do-not-touch production registry stays untouched in this plan (see staged follow-ups).

## Dev mode (`watch:*`)

| Process | shell | tinyurl |
| --- | --- | --- |
| Postgres (`docker compose -p supportfolio-dev … up -d --wait`) | yes | yes |
| Prometheus + Grafana (dev override) | yes | no |
| identity `bootRun` (DevTools) | yes | yes |
| shell gateway `bootRun` (DevTools) | yes | — |
| tinyurl-service `bootRun` (DevTools) | yes | yes |
| `nx serve tinyurl-microfrontend` (4201) | yes | yes |
| `nx serve shell-host` (4200) | yes | — |

Java reload: `spring-boot-devtools` as `developmentOnly` on the three services, plus one shared
continuous build (`gradlew -t :platform:identity:classes :platform:shell:classes
:projects:tinyurl:service:classes`) feeding it — restart of the affected service in ~3–5 s.
LiveReload is disabled (`spring.devtools.livereload.enabled=false`) — three instances would
otherwise race for port 35729. Fallback if output-lock contention appears: per-service
`gradlew :module:bootRun --continuous` (full ~10–15 s restart, no shared build).

Health gating uses `/actuator/health` HTTP checks (actuator is a convention), never bare TCP,
except Postgres (`pg_isready` healthcheck in compose) plus the service's readiness endpoint.

## Build-watch mode (`build-watch:*`)

Same processes; the dev server is replaced by a continuous build served by the backend:

- shell: `nx build shell-host --watch` → gateway with
  `SPRING_WEB_RESOURCES_STATIC_LOCATIONS=file:<abs>/dist/platform/shell/host/`; the remote
  stays on its dev server (4201). Browse `http://localhost:8080`.
- tinyurl: `nx build tinyurl-microfrontend --watch` → service with
  `SPRING_WEB_RESOURCES_STATIC_LOCATIONS=file:<abs>/dist/projects/tinyurl/microfrontend/`.
  Browse `http://localhost:8082`.

## Prod mode (`prod:*`)

- `prod:shell` (composed, platform surface): build 3 jars + 2 frontends + 3 images;
  `docker compose --profile observability up -d --wait shell prometheus grafana`;
  browse `http://localhost:18080`, Grafana `:13000`, Prometheus `:19090`.
- `prod:tinyurl` (**standalone — no shell**): build the service jar, the identity jar, and the
  microfrontend's **standalone** configuration; `docker compose -f docker-compose.demo.yml
  -f docker-compose.standalone.yml up -d --wait tinyurl-service`, which publishes
  `127.0.0.1:18082→8082` and adds `http://localhost:18082` to identity's redirect origins.
  Browse `http://localhost:18082`. "Standalone" removes the shell, not identity — it is a
  3-container stack (postgres, identity, tinyurl-service) by design.

### Standalone build configuration (per microfrontend, scaling rule)

A `standalone` build configuration in each Nx microfrontend project:
`baseHref: /`, `fileReplacements` to `environment.standalone.ts` (same-origin API, un-prefixed
`callbackPath`), output `dist/projects/<app>/microfrontend-standalone/`. The tinyurl Dockerfile
switches to carrying the standalone bundle (`/app/static`); the shell image keeps carrying the
composed bundle (`/app/static/apps/<id>/`). Zero identity code changes — `redirect-origins` is
already an env var; no CORS work because login is a top-level navigation and the token exchange
stays same-origin through the service's existing `/api/token`, `/auth/login`, `/oauth2/**`,
`/login/**` proxies.

## Operational hardenings (review-driven)

- Dev compose uses project name `supportfolio-dev` so `down` can never touch the demo volume.
- `npm run stop` kills the process tree (`taskkill /T`), stops Gradle daemons, and downs the
  `-p supportfolio-dev` stack only.
- e2e and `watch:*` are mutually exclusive locally (Playwright owns 4200/4201) — documented.
- No interactive stdin to children; per-process prefixed output from `concurrently`.

## Staged follow-ups (explicitly out of scope here, tracked as debt)

1. **Serve each app's bundle from its own service and have the gateway proxy
   `/apps/<id>/**`** (registry-driven upstream routing in `AppHostingConfig`). This removes the
   baked bundles from the shell image and finally honours the README's goal that "the shell is
   never rebuilt when a project is added or updated"; also removes the hand-maintained prod
   registry.
2. Derive the shell's CSP `trustedRemoteOrigins` from the hot-read registry instead of an env
   default.
3. CSP for the standalone service surface (today only the shell sets one).
4. Testcontainers-based local DB seeding for the dev loop.

## Files

Added: `tools/dev-orchestrator.ts` (+ Jest specs), `platform/project.manifest.yaml`,
`scripts/watch.ps1`, `scripts/prod.ps1`, `scripts/stop.ps1`, `scripts/dev-secrets.ps1`,
`.env.example`, `docker-compose.dev.yml`, `docker-compose.standalone.yml`,
`observability/prometheus/prometheus.dev.yml`,
`projects/tinyurl/microfrontend/src/environments/environment.standalone.ts`.
Changed: manifest schema (+`local`, `additionalProperties: false`, generic card check),
`projects/tinyurl/project.manifest.yaml` (+`local`), root `package.json` (+7 scripts,
+`concurrently`/`wait-on`), three `build.gradle.kts` (+`developmentOnly` devtools, −livereload),
tinyurl Nx project.json (+`standalone` config), `projects/tinyurl/Dockerfile` (standalone
bundle path), identity's dev redirect-origins via the standalone compose override.
Untouched: `docker-compose.demo.yml` core services, `platform/shell/config/remote-registry.json`,
`scripts/demo.ps1`, CI workflows (the drift gate joins the `tools/` Jest scope).

## Verification

- `npm run watch:shell`: `:4200` catalog with the real TinyURL card; `:8080/api/remote-registry`;
  `:8081/oauth2/jwks`; Prometheus 3 targets up; editing a `.java` file restarts only that
  service; port preflight catches a busy 8081 with a named error.
- `npm run watch:tinyurl`: `:4201` shortens a link; `/go/{slug}` redirects.
- `npm run build-watch:shell`: `:8080` serves the SPA; a TS edit rebuilds.
- `npm run prod:tinyurl`: `:18082` serves the standalone app, login round-trips through the
  service, the shell is **not** running.
- `npm run prod:shell`: `:18080/apps/tinyurl/` still composes identically.
- `tools/` Jest specs: closure resolution, cycle detection, port collisions, registry
  generation determinism.
