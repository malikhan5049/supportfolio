# Shell / Gateway

The Supportfolio shell: a Spring Cloud Gateway Server MVC that fronts the Identity
service, serves the SPA host, publishes the remote registry, and applies CSP from a
trusted-origin allowlist. It contains **no project business logic**.

## Run it (dev)

One command starts everything; no per-service terminals. Prerequisites: JDK 17, Node 24 and
Docker Desktop.

```powershell
# One-time: create .env from .env.example and fill the absolute dev key path
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev-secrets.ps1

# Everything: identity, postgres, tinyurl service, both dev servers, telemetry, shell
npm run watch:shell

# Same graph, but the gateway serves the built SPA hosts (no nx dev servers)
npm run build-watch:shell

# Print the resolved plan (processes, env, generated registry path) and spawn nothing
npm run start:plan

# Tear down: Gradle daemons, dev port listeners, supportfolio-dev/prod containers
npm run stop
```

`npm run stop` is deliberately blunt: it kills ANY process listening on a platform-reserved port
(4200, 4201, 8080–8083, 9091–9093) and downs the `supportfolio-dev` and `supportfolio-prod` compose
projects. The demo stack (`scripts/demo.ps1`, project `supportfolio`) is untouched.

`watch:shell` starts 8 processes with coloured `[name]` prefixes: `identity`, `postgres`,
`tinyurl-service`, `tinyurl-microfrontend`, `telemetry`, `shell`, `shell-host`, `compile`. Spring
services `wait-on` their dependencies' actuator health before booting, and the dev registry
(`platform/shell/config/remote-registry.dev.json`) is generated from the project manifests before
anything spawns. `.env` is git-ignored; fill real GitHub credentials there before login can work.

`[compile]` is a continuous `gradlew -t …classes` watcher over every Gradle module in the closure:
DevTools restarts Java only when class files change, so without it the dev loop has nothing to
restart on. It starts last so it never competes for a Gradle daemon; cold boot still takes ~3 min
because each Spring service compiles before it serves.

| Port | Owner |
| --- | --- |
| 4200 | `shell-host` (SPA host dev server) |
| 4201 | `tinyurl-microfrontend` (remote entry) |
| 8080 | shell gateway |
| 8081 | identity |
| 8082 | tinyurl service |
| 5432 | postgres |
| 9091 | shell management (actuator) |
| 9092 | identity management (actuator) |
| 9093 | tinyurl service management (actuator) |
| 19090 | prometheus |
| 13000 | grafana |

> `watch:*` and `build-watch:*` are mutually exclusive with `npx nx e2e shell-host-e2e`: Playwright's config runs `npx nx serve tinyurl-microfrontend --port 4201 --configuration=development` and `npx nx serve shell-host --port 4200 --configuration=e2e`, so the dev servers must be stopped first.

**Prod topology:** `prod:shell` runs the composed platform (shell + TinyURL inside it + telemetry) on
:18080; `prod:tinyurl` runs TinyURL standalone on :18082 with no shell. Both use the
`supportfolio-prod` compose project over the same postgres/identity/tinyurl-service containers, so a
second `up` reconciles — i.e. recreates — the first stack's services: run one at a time.

Environment defaults for the children: identity `http://localhost:8081`, registry file
`platform/shell/config/remote-registry.dev.json`, trusted origins
`http://localhost:4200,http://localhost:4201`. Override with `SUPPORTFOLIO_SHELL_IDENTITY_URI`,
`SUPPORTFOLIO_SHELL_REMOTE_REGISTRY_FILE`, `SUPPORTFOLIO_SHELL_TRUSTED_REMOTE_ORIGINS`.

The orchestrator pins the shell it spawns its children in (cmd.exe on Windows), so a Git Bash npm
`script-shell` (`npm config get script-shell`) no longer breaks the Gradle processes.

### Add project #4

Create `projects/<id>/project.manifest.yaml` with a `local:` block — `service`
(`gradleModule`, `port`, `managementPort`, `healthPath`), `frontend` (`nxProject`, `devPort`),
`dependsOn` and `databases` — then run `npm run start:plan` to see the resolved graph. The dev
registry, the trusted origins and the process list are generated from the manifests: no
orchestrator edit, and the shell is never rebuilt or restarted.

## Remote registry contract

`GET /api/remote-registry` → `{"projects":[{id, displayName, shortDescription, features[],
openUrl, exposedModules:[{name, version, remoteEntry}]}]}`. An unreadable registry answers
`503 {"error":"registry_unavailable"}` (no path or validation detail leaked).

**The registry file is data hot-read by the gateway on every request.** In a real deployment
a project's pipeline would rewrite its own entry on release; today the production registry
home is deferred and the repo file is the dev/sample registry. The shell is never rebuilt or
restarted when a project is added or updated.

`platform/shell/config/remote-registry.json` in the repo is the dev/sample registry.

## Trusted origins

`SUPPORTFOLIO_SHELL_TRUSTED_REMOTE_ORIGINS` is a configuration allowlist — the ONLY origins
whose remote entries load and appear in CSP. Registry *entries* are data: a registry row
pointing at an unallowed origin is dropped, never trusted. The two are kept separate on
purpose.

## Identity URLs: dev vs prod

In dev the SPA login *navigation* goes directly to Identity (`http://localhost:8081` in a
top-level navigation, so no CORS is involved), while the one-time-code exchange goes
through the gateway same-origin (`/api/token` is proxied). In production the gateway
serves the SPA and proxies all Identity browser endpoints, so everything is same-origin.
No `Access-Control-Allow-*` header is intentionally configured anywhere.

## Demo

The shell is the public entry point for the demo stack. Start it with everything else:

```powershell
# Core stack + Cloudflare quick tunnel
.\scripts\demo.ps1

# Core stack only on http://localhost:18080
.\scripts\demo.ps1 -NoTunnel

# Inert-flag check: demo login and demo seeding off
.\scripts\demo.ps1 -NoTunnel -NoDemo
```

The runner sets `DEMO_ENABLED=true`, so the demo login entry point is available without GitHub.

Verify locally from PowerShell 5.1:

```powershell
curl.exe -f http://localhost:18080/api/remote-registry
curl.exe -f http://localhost:18080/apps/tinyurl/
```

Reset command (destroys the database volume):

```powershell
docker compose -f docker-compose.demo.yml --profile tunnel down -v
```

Keep the laptop awake during the demo. If `*.trycloudflare.com` is blocked, use
`ngrok http 18080` as a drop-in fallback — the stack does not depend on cloudflared.
