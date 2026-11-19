# TinyURL

Short links with public click counts, one Spring Boot service (port `8082`) and one Angular
microfrontend (port `4201`) that both runs the app at its own origin and exposes the project card
the shell renders (`card@1.0.0`).

## Run it (dev)

1. **Postgres** — `docker compose -f projects/tinyurl/docker-compose.yml up -d`
   (localhost-only dev defaults: db/user/password `tinyurl`.)
2. **Identity** — the login flow needs `http://localhost:4201` in
   `SUPPORTFOLIO_IDENTITY_REDIRECT_ORIGINS` before Identity starts.
3. **TinyURL service** — `./gradlew :projects:tinyurl:service:bootRun` (port 8082; env overrides like
   `SUPPORTFOLIO_TINYURL_DB_*`, `SUPPORTFOLIO_TINYURL_IDENTITY_URI`, `SUPPORTFOLIO_TINYURL_RATE_LIMIT_PER_HOUR`).
4. **TinyURL frontend** — `npx nx serve tinyurl-microfrontend` (port 4201; the dev proxy sends
   `/api/token` and `/auth/login` to Identity, everything else `/api/**` to the service).
5. **Shell** — `npx nx serve shell-host`; the catalog card opens `http://localhost:4201`.
   Once one more project lands there will be two cards; today the dev grid shows exactly this one.

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
| `SUPPORTFOLIO_TINYURL_IDENTITY_URI` | service gateway proxy | `http://localhost:8081` | `http://identity:8080` (deploy env) |
| `SUPPORTFOLIO_TINYURL_RATE_LIMIT_PER_HOUR` | service rate limiter | `20` | `20` |
| `SUPPORTFOLIO_TINYURL_JWK_SET_URI` / `_ISSUER_URI` | service JWT validation | localhost 8081 | deploy env |

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
```

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
