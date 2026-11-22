# TinyURL

Short links with public click counts, one Spring Boot service (port `8082`) and one Angular
microfrontend (port `4201`) that both runs the app at its own origin and exposes the project card
the shell renders (`card@1.0.0`).

## Run it (dev)

One command starts this project's slice; no per-service terminals. Prerequisites: JDK 17, Node 24
and Docker Desktop.

```powershell
# One-time: create .env from .env.example and fill the absolute dev key path
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev-secrets.ps1

# postgres + identity + the service (8082) + the microfrontend dev server (4201)
npm run watch:tinyurl

# Same services, but the service serves the built SPA and remote entry on http://localhost:8082
npm run build-watch:tinyurl

# Print the resolved plan (processes, env, generated registry path) and spawn nothing
npm run start:plan

# Tear down: Gradle daemons, dev port listeners, supportfolio-dev containers
npm run stop

# Standalone production build: postgres + identity + tinyurl service + SPA on http://localhost:18082
npm run prod:tinyurl
```

`watch:tinyurl` starts 4 processes with coloured `[name]` prefixes: `identity`, `postgres`,
`tinyurl-service`, `tinyurl-microfrontend`. It has **no** telemetry: its `local.dependsOn` is
`["identity"]` with `databases: ["postgres"]`, so Prometheus/Grafana only come up with
`watch:shell` (the shell manifest's `dependsOn` includes `telemetry`).

| Port | Owner |
| --- | --- |
| 4201 | `tinyurl-microfrontend` (remote entry and app) |
| 8082 | tinyurl service |
| 8081 | identity |
| 5432 | postgres |
| 9092 | identity management (actuator) |
| 9093 | tinyurl service management (actuator) |
| 18082 | `prod:tinyurl` standalone (postgres + identity + the service, **no shell**) |

> `watch:*` and `build-watch:*` are mutually exclusive with `npx nx e2e shell-host-e2e`: Playwright's config runs `npx nx serve tinyurl-microfrontend --port 4201 --configuration=development` and `npx nx serve shell-host --port 4200 --configuration=e2e`, so the dev servers must be stopped first.

The catalog card opens `http://localhost:4201`; with `watch:shell` the shell renders it on
`http://localhost:4200`. The orchestrator pins the shell it spawns its children in (cmd.exe on Windows), so a Git Bash npm
`script-shell` no longer breaks the Gradle processes.

### Add project #4

Create `projects/<id>/project.manifest.yaml` with a `local:` block — `service`
(`gradleModule`, `port`, `managementPort`, `healthPath`), `frontend` (`nxProject`, `devPort`),
`dependsOn` and `databases` — then run `npm run start:plan`. The dev registry, the trusted origins
and the process list are generated from the manifests: no orchestrator edit.

## API

- `GET /api/links` — public list (`slug`, `targetUrl`, `clickCount`, `createdAt`; newest first).
- `POST /api/links` — `{"targetUrl"}`, admin/user JWT; 401 anonymous, 403 other roles,
  400 `invalid_target_url` (private/loopback/credential targets), 429 `rate_limited` over 20/hour/user.
- `GET /go/{slug}` — public 302 redirect; records exactly one click row per follow;
  404 `link_not_found` for unknown slugs.
- `GET /actuator/health/liveness` / `readiness` — split probes; readiness reflects the database.
- `GET /v3/api-docs`, `GET /swagger-ui/index.html` — OpenAPI published from the running service.

## Environment

| Variable | Goes to | Dev default | Prod |
| --- | --- | --- | --- |
| `SUPPORTFOLIO_TINYURL_DB_USER` / `_PASSWORD` | service datasource | `tinyurl` / `tinyurl` | env-only |
| `SUPPORTFOLIO_TINYURL_IDENTITY_URI` | service gateway proxy | `http://localhost:8081` | `http://identity:8080` (demo stack env) |
| `SUPPORTFOLIO_TINYURL_RATE_LIMIT_PER_HOUR` | service rate limiter | `20` | `20` |
| `SUPPORTFOLIO_TINYURL_JWK_SET_URI` / `_ISSUER_URI` | service JWT validation | localhost 8081 | demo stack env |

The frontend dev/prod split lives in `microfrontend/src/environments/`; production resolves
Identity login and short links same-origin (`''`), the dev defaults are `localhost:8081`/`8082`.

## Tests

```bash
./gradlew :projects:tinyurl:service:test                 # backend (Testcontainers, Docker required)
npx nx test tinyurl-microfrontend                        # frontend Jest
npx nx e2e shell-host-e2e                                # shell renders the real card
npx playwright test --config=projects/tinyurl/ci/playwright.prod.config.ts   # prod login flow (Docker)
```

The demo stack is the current deployment surface; see `docker-compose.demo.yml` and `scripts/demo.ps1`.

## Demo

The demo stack runs everything in Docker with a single PowerShell runner and an optional
Cloudflare quick tunnel.

```powershell
# Start Postgres + Identity + TinyURL + Shell, then open a public tunnel
.\scripts\demo.ps1

# Core stack only (localhost:18080, useful for CI/local validation)
.\scripts\demo.ps1 -NoTunnel

# Inert-flag check: same stack with demo login and demo seeding off
.\scripts\demo.ps1 -NoTunnel -NoDemo
```

The runner sets `DEMO_ENABLED=true` (demo login + seeded links); `-NoDemo` leaves those flags off.

Smoke-test the localhost endpoints from PowerShell 5.1:

```powershell
curl.exe -f http://localhost:18080/api/remote-registry
curl.exe -f http://localhost:18080/apps/tinyurl/
```

Reset command (destroys the database volume):

```powershell
docker compose -f docker-compose.demo.yml --profile tunnel down -v
```

Keep the laptop awake while the demo is in use — the tunnel drops when the container stops.
If `*.trycloudflare.com` is blocked on the interview network, `ngrok http 18080` is a
drop-in fallback; the stack itself has no dependency on cloudflared specifics.
