# Showcase Deployment — Cloudflare Quick Tunnel (replaces Oracle/k3s)

Status: Draft, awaiting human approval
Date: 2026-11-18
Supersedes in part: `2026-10-16-portfolio-platform-design.md` (infrastructure section),
`2026-10-20-tinyurl-design.md` (acceptance criteria 11–13 and the cluster-plan scope boundary)
Superseded plan: Plan 5 "cluster/infra" (never written). This document defines its replacement.

## Intent

The portfolio must be demonstrable to an interview panel, at zero cost, for a short window.
The Oracle Always Free VM / k3s path is dropped for reasons outside the project. Instead, the
whole platform runs as a Docker Compose stack on the owner's Windows laptop and is published for
the duration of the interview through a Cloudflare Quick Tunnel (`*.trycloudflare.com`).

This is a **showcase deployment**, not a production deployment. It must nonetheless be shaped so
that moving to a real host later is a configuration change, not a rewrite: the same images, the same
compose model, the same paths, and no hostname baked into any artifact.

Success looks like: the owner sends one URL; the reviewer opens it, sees the shell grid with the
TinyURL card, opens it, browses seeded links, signs in with one click, shortens a link, copies the
absolute short URL, opens it, and watches the click count increment — with no manual steps during
the call beyond starting the stack.

## Goals

1. One command starts the full stack locally; one URL is handed to the reviewer.
2. Every public URL is derived at request time. Restarting the tunnel with a new random hostname
   requires **no** file edits, rebuilds, or restarts of application containers.
3. Hosting is path-based under a single origin, so a second app can be added later by adding its
   build plus one registry entry — not by re-plumbing the tunnel.
4. The demo exercises the real authentication and authorization machinery (JWT issuance, resource
   server validation, role-gated shorten), not a stub.
5. Removing the demo capability later is a property flip plus deleting one controller and one
   seeder; no production path depends on them.
6. The repository stops claiming a cluster it never had: k3s manifests, arm64 builds, ARM runners,
   GHCR promotion and the deploy workflow are removed, and CI proves the actual demo stack instead.

## Non-goals

- A domain, DNS, TLS certificates, Cloudflare Access, or any access gate. The link itself is the
  only secret and the demo is publicly reachable while it runs.
- Cloudflare named tunnels, accounts, or configuration files.
- Or any cloud/VM provisioning, Kubernetes, CD to a remote cluster, SBOM policy, promote gates,
  or image registries.
- Admin-triage ("Plan 6"), the scaffold "add a new app live" flow, Keycloak, per-app detail pages.
- Data durability. The demo dataset is disposable and reset by dropping the database volume.

## Anti-goals

- Anything that only works because the hostname happens to be `localhost`.
- A public bypass of authorization in the default configuration. The demo login must be inert
  unless explicitly enabled by configuration, and must be absent from every non-demo deployment.
- A second copy of the security headers/CSP logic outside the shell gateway.
- Silent divergence between the committed registry and the running stack.

## Constraints (facts established during recon)

| Constraint | Evidence |
|---|---|
| Quick tunnels give a random hostname per process and cannot be gated | no domain owned; Cloudflare Access requires a zone |
| One tunnel = one hostname, so all apps must share an origin | single public URL requirement |
| Registry is read from the filesystem per request, uncached | `RemoteRegistry.java:70-71` |
| Registry currently rejects non-`http(s)` URLs and requires the origin to be trusted | `RemoteRegistry.java:112-116` |
| Shell jar does not package any Angular build | `platform/shell/build.gradle.kts` has no copy task |
| Gateway routes are pass-through with no `StripPrefix` | `platform/shell/src/main/resources/application.yaml:17-34` |
| Identity endpoints are root-absolute; no context path, no forwarded-header handling | no `server.servlet.*`, zero `X-Forwarded` hits |
| Identity has no `@Profile` usage and binds `GitHubIdentityProvider` concretely | `SecurityConfig.java:66-68`, `CustomOAuth2UserService.java:86-89` |
| Resource-server validation is issuer-only (no `aud`/`scope`), absent role claim still authenticates | `IdentityResourceServerAutoConfiguration.java:40-41,70-83` |
| Angular apps use `<base href="/">`; MF builds set no `publicPath`/`filename` | `*/src/index.html:6`, `tinyurl/webpack.config.js` |
| TinyURL client calls root-absolute `/api/links` | `link-api.service.ts:24,29` |
| Compose today is Postgres-only, not a deployment definition | `projects/tinyurl/docker-compose.yml` |
| Several validators hard-assert k3s/arm64/deploy artifacts | `tools/validate-tinyurl-deploy.spec.ts`, `validate-workflows.spec.ts`, `validate-tinyurl-docs.spec.ts`, `branch-protection.spec.ts` |

## Approaches considered

**A. Package the shell; path-based single origin (chosen).** Gate all traffic through the shell jar.
It serves the shell SPA and every app build under `/apps/<id>/`, proxies `/auth/**`-free identity
paths and per-app APIs, and derives absolute URLs from the request. Registry entries become
root-relative. One compose stack, one tunnel, one origin.

**B. nginx ingress in front of built frontends.** Build both SPAs, let nginx serve them and proxy the
services. Less Java work, but duplicates CSP/security headers outside the gateway, keeps the shell
jar unshippable, and adds a second ingress config to keep in sync.

**C. One tunnel per app with a startup registry rewrite.** Near-zero code change, but multiple random
URLs, a startup race, cross-origin cookies and a `*.trycloudflare.com` CSP wildcard. Rejected.

A was chosen because it is the only option where the interview artifact and the future VPS artifact
are the same thing. B remains the documented fallback if shell packaging fights back.

### Corrections to the pre-recon sketch

- **No `/auth` prefix is needed.** Identity's `/api/token`, `/oauth2/**`, `/login/**` and
  `/api/demo-login` do not collide with the shell's `/`, `/signin`, `/auth/callback`, `/projects/**`
  or `/apps/**`. Routes stay pass-through; no `StripPrefix` on identity, no context path, no
  rewritten `redirect_uri`.
- **The demo login is not a second `IdentityProvider` adapter.** That port is bound concretely inside
  the OAuth2 user service, so an adapter would mean rewiring security for no gain. A flag-gated
  controller that mints a one-time code through the existing `OneTimeCodeStore` reaches the same
  `TokenController` → `JwtIssuer` path with one class and one property.

## Decided design

### Topology

```
reviewer ──https──▶ cloudflared (quick tunnel) ──http──▶ shell (Spring MVC gateway + static)
                                                          ├── /                      shell SPA
                                                          ├── /apps/<id>/            app builds
                                                          ├── /apps/<id>/api/**  ──▶ project service
                                                          ├── /go/**             ──▶ tinyurl
                                                          └── /api/{token,remote-registry,session,features,demo-login}
                                                                                        │
                                                        identity ◀──────────────────────┘
                                                        tinyurl-service ──▶ postgres
```

Compose services: `postgres`, `identity`, `tinyurl-service`, `shell`, `tunnel` (profile `tunnel`).
Only the tunnel has a published port; everything else is internal. PNG-free, no volumes except the
Postgres data volume.

### Public surface

| Path | Served by | Auth |
|---|---|---|
| `/`, `/signin`, `/auth/callback`, `/projects/**` | shell SPA (`SpaForwardController` whitelist, unchanged) | public |
| `/apps/<id>/` and assets | shell static (`file:/app/static/apps/<id>/`) | public |
| `/apps/<id>/api/**` | project service, `StripPrefix=2` | per endpoint |
| `/go/{slug}` | tinyurl service | public GET |
| `/api/remote-registry` | shell | public |
| `/api/features` | shell (new) | public |
| `/api/session/me` | shell | JWT |
| `/api/token` | identity (existing route) | public POST |
| `/api/demo-login` | identity (new), flag-gated | public POST when enabled |
| `/oauth2/**`, `/login/**`, `/auth/login` | identity (existing routes, unused in demo) | public |

Two POSTs need explicit shell-side wiring, or they 404/403 at the gateway: a pass-through route
`Path=/api/demo-login` → identity, and `csrf-ignore-paths` entries for `/api/demo-login` and
`/apps/*/api/**` (the shorten call). Identity separately permits and CSRF-ignores
`/api/demo-login`. Both additions are inert once the demo flags are off.

### Hostname independence

- Registry entries for `openUrl` and `remoteEntry` become **root-relative** (`/apps/tinyurl/`,
  `/apps/tinyurl/remoteEntry.js`). The browser resolves them against whatever origin served the page.
  `loadRemoteModule` receives the string verbatim and injects `<script src>`, so a root-relative
  value is correct under any hostname.
- `RemoteRegistry` validation gains a second accepted form: absolute `http(s)` URLs keep the
  trusted-origin check; values beginning with `/` are accepted as same-origin. CSP already allows
  `'self'`, so no origin needs to be added to `trusted-remote-origins` for the demo.
- Absolute short links are built **server-side** from the request (honoring `X-Forwarded-*`), not
  client-side from an empty base. `server.forward-headers-strategy=framework` is enabled on the shell
  and tinyurl service. The shorten/list API returns the absolute `shortUrl`; the client displays it
  verbatim. A copied link must work when pasted into a different browser.
- Identity's `iss` / resource-server `issuer-uri` stay on the internal service URL
  (`http://identity:8081`). They are never browser-visible, so the tunnel hostname plays no part.

### Shell packaging

- New `platform/shell/Dockerfile` and `platform/identity/Dockerfile`, same artifact-only pattern as
  TinyURL's (prebuilt jar, no in-image build). The shell image copies the prebuilt `shell.jar` plus
  `dist/platform/shell/host` (to `/app/static/`) and every app build
  (`dist/projects/tinyurl/microfrontend` → `/app/static/apps/tinyurl/`).
- `SPRING_WEB_RESOURCES_STATIC_LOCATIONS=classpath:/static/,file:/app/static/`.
- A resource resolver for `/apps/**` falls back to `apps/<id>/index.html` for extension-less paths so
  deep links and refreshes work; `/apps/<id>` redirects to `/apps/<id>/` so relative assets resolve.
- No Gradle change: packaging stays a Dockerfile concern, keeping `bootRun` untouched.

### Gateway and security configuration

- Routes added: `Path=/apps/*/api/**` → tinyurl service with `StripPrefix=2`; `Path=/go/**` → tinyurl
  service. Identity routes unchanged.
- Shell `permit-paths` gains `/apps/**`, `/go/**`, `/api/features`, `/api/demo-login`; `/api/session/me`
  remains authenticated. Same-origin hosting does not bypass the security chain: without these,
  static app assets would return 401.
- Adding app #2 later = its build `COPY` line, one gateway route, one registry entry. The fully
  dynamic `RouteLocator` driven by a new `apiUri` registry field is noted as the next increment, not
  built now.

### Frontends

- `platform/shell/host`: `<base href="/">` stays. `provideAuth` drops the hardcoded
  `http://localhost:8081` and uses `''` (same-origin), removing the ungated leak the bundle gate
  never scanned.
- `tinyurl` microfrontend: production build uses `<base href="/apps/tinyurl/">` and
  `output.publicPath: 'auto'`. The API base comes from `environment.apiBaseUrl`
  (`/apps/tinyurl` in production), so `link-api.service.ts` composes `${apiBaseUrl}/api/links`
  instead of the root-absolute literals. The dev server keeps `<base href="/">` and its proxy.
- The shared auth interceptor currently attaches the JWT only when `req.url.startsWith('/api/')`,
  which would silently drop the token on `/apps/tinyurl/api/**`. Its predicate becomes a
  configurable list of same-origin prefixes in `AuthConfig` (`apiUrlPrefixes`, default `['/api/']`);
  the tinyurl app passes `['/apps/tinyurl/api/']`. The token is still never sent to a different
  origin — the prefixes are matched only against same-origin paths.
- The app's `callbackPath` becomes `auth/callback` (app-relative, so `/apps/tinyurl/auth/callback`
  under the base href) while the shell keeps `/auth/callback`.
- `prod-bundle-gate.ts` is extended to scan the shell's dist as well, so `localhost:8081` can never
  re-enter either bundle.

### Demo login (flag-gated, real token path)

- `POST /api/demo-login` in the identity service, `@ConditionalOnProperty` on
  `supportfolio.identity.demo-enabled=true`. It builds a fixed `InternalPrincipal` with role `admin`,
  calls `OneTimeCodeStore.create`, and returns `{ "code": "..." }`. Permit it in identity's
  `SecurityConfig` and add it to the CSRF ignore list (POST would otherwise be rejected).
- The control lives in the **shared** `LoginPageComponent`, so it appears on both the shell's
  `/signin` and the app's `/apps/tinyurl/signin` — no duplicated UI, and the reviewer signs in where
  they will shorten. It is rendered only when `GET /api/features` (shell, public) reports
  `{"demoLogin":true}`; that endpoint reads `supportfolio.shell.demo-login-enabled`.
- Clicking it POSTs `/api/demo-login`, then navigates to the app-relative `auth/callback?code=…`,
  which the existing `AuthCallbackComponent` already exchanges and stores. No new client auth logic.
- One `DEMO_ENABLED` value in `docker-compose.demo.yml` feeds the three flags (identity demo, shell
  features, tinyurl seeding), so enabling or removing the demo is one switch plus deleting one
  controller and one seeder.
- Acceptance order therefore is: grid → Open TinyURL → browse seeded links → sign in (demo) →
  shorten → copy the absolute short URL → open it → count increments.
- Identity needs values for settings it treats as mandatory even though GitHub login is unused:
  dummy `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET`, `adminLogin`, an allowlist, and a non-empty
  `redirect-origins`. The OAuth2 chain stays wired but inert; no conditional client registration is
  introduced, keeping the "remove the demo later" surface to the controller, the seeder and the flag.
- Demo configuration sets a 4-hour access-token TTL so a long interview does not expire mid-flow.

### Seeded data

A flag-gated seeder in the tinyurl service (`supportfolio.tinyurl.demo-seed-enabled=true`) inserts
five links with varied creation dates and click rows on startup when the table is empty, so the browse
page and click counts are never empty on first load. Idempotent; no effect when the flag is off.

### Runtime operation

- `docker-compose.demo.yml` at repo root; `tunnel` under profile `tunnel` so CI never exposes a URL.
  The shell publishes `127.0.0.1:18080:8080` for local verification and for the CI/Playwright run;
  the tunnel is the only *public* ingress, and a real-host deployment can drop the loopback publish
  with an override file rather than changing the base compose.
- `scripts/demo.ps1` (PowerShell-first per AGENTS.md): builds jars and frontend dists, brings the
  stack up, tails tunnel logs, prints the public URL, and reminds the owner to keep the laptop awake.
- `docker compose --profile tunnel down -v` resets demo data.
- `robots.txt` disallowing everything plus an `X-Robots-Tag: noindex` header on shell responses.

### CI and validators

- Delete: `projects/tinyurl/deploy/` (7 files), `projects/tinyurl/ci/trivy.yaml`,
  `.github/workflows/deploy.yml` and `platform/harness/workflows/deploy.yml`, the
  `sync-harness-workflows.ts` entry for `deploy.yml`.
- `tinyurl-ci.yml`: remove `tinyurl-k3s-manifests`, `tinyurl-arm-smoke`, `deploy-test`, `deploy-prod`,
  and the buildx/GHCR/arm64/attestation/trivy steps from `tinyurl-image`; keep the jar and frontend
  builds plus the bundle gate.
- Add a `demo-stack` job: build the artifacts, `docker compose -f docker-compose.demo.yml up -d
  --build --wait`, assert `/`, `/api/remote-registry`, `/apps/tinyurl/remoteEntry.js`, demo login →
  shorten → `/go/{slug}` → click count, then tear down. Playwright spec retargeted from the old
  stub-identity compose to the shell origin (`localhost:18080`), keeping the same assertions.
- Rewrite `tools/validate-tinyurl-deploy.spec.ts` (delete), `validate-tinyurl-docs.spec.ts`
  (drop deploy/README and the k3s check name; replace the `4201` assertion), `validate-workflows.spec.ts`
  (arm64/k3s/deploy assertions → demo-stack assertions), `branch-protection.ts` + its spec
  (`tinyurl-k3s-manifests` → `demo-stack`), and `platform/harness/ACTIVATION.md`.

### Document changes

- This design becomes the infra authority. Both parent specs are amended in place at the specific
  sections that name Oracle/k3s/GHCR/arm64, each gaining a dated "Amended by" note; unrelated
  content is untouched. This deviates from the standing "specs are read-only records" rule at the
  human's explicit request, so a `Ruling:` ledger line is written to `retrospectives.md` in the same
  change.
- A new plan `docs/superpowers/plans/2026-11-18-showcase-deployment.md` replaces Plan 5. Plan 6
  (admin-triage) stays deferred and is marked out of showcase scope.
- `AGENTS.md` repo map and CI gate list are corrected to the real project names
  (`platform/shell`, `tinyurl-microfrontend`) while the deployment model is described.

## Risks and fallbacks

| Risk | Mitigation |
|---|---|
| Corporate network blocks `*.trycloudflare.com` | No hostname is baked anywhere; `ngrok http 8080` or any HTTPS reverse proxy is a drop-in replacement. Runbook documents the swap. |
| Laptop sleeps / tunnel drops mid-interview | `demo.ps1` prints the URL and wake settings; restarting the stack yields a new URL that is re-sent, with no rebuild because nothing depends on the hostname. |
| Reviewer's link is public | Demo data only, reset command, `noindex`, rate limit intact, demo login disabled everywhere except the demo config. |
| Shell packaging slips | Documented fallback: nginx ingress in front of the same builds; the frontend work (base href, publicPath, relative APIs) is reusable. |
| Tunnel hostname appears in a cached response | All responses are dynamic and `Cache-Control` is not set to public for HTML; the demo is short-lived. |

## What is left to the builder

- Exact Angular output directory under `dist/platform/shell/host` (`browser/` or root) for the
  Dockerfile.
- Whether StripPrefix index for `/apps/{id}/api/**` is 2 or 3 given the gateway's path parsing —
  verify with a routing test.
- The safest way to mount the identity signing key: prefer generating a gitignored demo key in
  `demo.ps1` if `platform/identity/dev-key.pem` is absent, never copying the existing one. The
  container reads it through `supportfolio.identity.jwt-private-key-file` (added in Task 8), since a
  multi-line PEM does not survive environment-variable plumbing cleanly.
- Whether the app SPA fallback is best implemented as a resource resolver or a controller; pick one
  and cover it with a test.
- Confirm the auth token store survives the demo-login → callback → browse navigation within a single
  app bootstrap (same-origin persistence makes it moot across pages, but verify either way).
- Final compose health-check timings on this laptop.

## Verification (definition of done)

1. `./gradlew.bat build`, `./gradlew.bat -p build-logic test`, and the three Nx lint/test/build gates
   stay green.
2. `docker compose -f docker-compose.demo.yml up -d --build --wait` with the tunnel profile yields a
   printed HTTPS URL that serves the grid, the app, a working demo login, a shorten, and an
   incrementing click count.
3. Restarting only the `tunnel` service changes the public URL, and the old flow works unchanged on
   the new URL with no rebuild.
4. Grep proves no `localhost` identity/registry URL remains in either shipped bundle.
5. CI green with `demo-stack` as a required check; no k3s/arm64/deploy references remain in code,
   workflows, or validators.
