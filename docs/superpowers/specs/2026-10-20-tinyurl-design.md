# TinyURL — Design (Plan 4)

Status: Draft, pending human approval
Date: 2026-10-20
Owner: you (repo owner / sole admin)

Parent spec: [2026-10-16-portfolio-platform-design.md](2026-10-16-portfolio-platform-design.md) —
"Phase 1 scope" item 2. This document argues from it and never contradicts it.
Consumes directly: [Plan 3 (shell/gateway)](../plans/2026-10-20-shell-gateway.md) — the shell,
the shared auth library, the remote registry, and the identity-card fixture this plan replaces.

> Amended 2026-11-18: the Oracle/k3s/arm64/GHCR deployment surface and CD wiring are superseded by the local Docker Compose + Cloudflare Quick Tunnel showcase model. See `2026-11-18-showcase-deployment-design.md`. Long-term hosting remains an open question.

## Intent and Why

TinyURL is the platform's first real project: the recruiter-facing proof that the whole
pattern works, not just the plumbing. Plans 1–3 delivered the harness, the Identity
service, and the shell — but the only thing on the shell's card grid today is a
disposable fixture. Plan 4 replaces that fixture with a real URL shortener
(own service, own datastore, own microfrontend, own manifest, own pipeline entry), so
a visitor sees a card on the grid that loaded dynamically at runtime, opens a full
app in its own tab, logs in right there, and shortens a real URL against a real
database.

Two things get proven for the first time:

1. The complete "add a project" path — registry entry, trusted origin, card module,
   manifest, CI entry — exercised by a real product rather than a test double.
2. **Demo-ready by construction**: the local Docker image build, the `docker-compose.demo.yml` stack, `/apps/tinyurl/` routing, absolute short URLs, and the demo login flow are committed, reviewed, and CI-proven at merge time — so the showcase works locally without a real cluster, and a future hosting plan only has to replace the local tunnel with real DNS/TLS/hosting.

## Goals

- A working URL shortener: anyone can browse links and their click counts without
  logging in; a logged-in admin or allowlisted user can shorten a URL.
- TinyURL's real card renders on the shell grid via the runtime remote registry —
  no shell host code or build change, no shell rebuild.
- The card's Open action opens the full shortener app in a new tab at TinyURL's own
  origin, with its own login page reachable directly (shared auth library, same
  Identity service, same JWT).
- A real datastore: PostgreSQL, database-per-service, one click row per redirect,
  so richer analytics can grow later without a schema rewrite.
- An owned API contract: OpenAPI published from the running service
  (platform spec's scalability principle; CODING_STANDARDS.md).
- Demo-ready stack artifacts (local Docker image build, `docker-compose.demo.yml`, `/apps/tinyurl/` routing, absolute short URL, demo login flow) — committed, reviewed, and CI-proven at merge time; nothing executes against a real cluster.
- The identity-card fixture and every touchpoint that references it are removed
  cleanly, with all existing CI checks staying green.

## Non-Goals

- The Oracle Cloud VM, the k3s cluster, the domain, DNS/TLS wiring, executing CD, and Grafana Cloud telemetry shipping — all deferred to a future real-hosting plan.
- The scaffold-template work: evolving `tools/plugins/project-scaffold` by extracting
  this plan's lessons (e.g. the Module Federation rulings) — a later plan does that.
- The admin-triage app (telemetry/triage views) — its own later plan.
- A second project through the "Add new app" flow — phase 2 per the platform spec.
- Deferred TinyURL features (YAGNI, deliberately): custom slugs, link expiry, editing
  targets, QR codes, charts or per-link analytics pages, any TinyURL admin UI.
- Browsing pagination, search, or sorting beyond a simple list.

## Anti-Goals

Carried from the platform spec; these count as failure even if it "works":

- The shell learns anything about TinyURL's business logic (breaks independent
  scalability/extraction).
- The harness becomes bespoke to TinyURL — adding project #2 must still be
  configuration (manifest + registry entry + CI entry), not pipeline rewrites.
- TinyURL grows its own permission machinery or auth-provider knowledge (GitHub or
  Keycloak specifics live only in Identity; TinyURL is a plain resource server).
- Anything deploys to prod without a human approval step — including the admin.

## Decided

Decisions marked **(human)** were made with the human and are binding; those marked
**(my call)** were delegated and are decided here in the declarative form the builder
implements; those marked **(ruling)** or **(builder-check follow-up)** came out of
builder checks on this spec and are equally binding. Everything here is decided —
the builder does not need to ask.

### Product behavior

- **(human)** Browsing is public: anyone, without login, can list links with their
  total click counts. The public list exposes only non-sensitive fields — slug,
  target URL, click count, creation time. Creator identity is never in the public
  payload.
- **(human)** Shortening requires a logged-in user whose role is `admin` or `user`
  (Identity's existing roles: admin = repo owner, user = explicitly allowlisted).
  TinyURL adds no new permission machinery — Identity only ever issues tokens to
  those two roles, so the gate is "valid Identity-issued JWT with role
  admin|user"; the service still checks the role claim itself (defense in depth).
- **(human)** Click analytics, simplest form: the browse list shows a total click
  count per link; every redirect records one `link_clicks` row so richer analytics
  can grow later without a schema rewrite.
- **(human)** `/go/{slug}` redirects to the target, which is fixed at creation.
- **(my call)** Slugs are system-generated, unguessable, and never sequential
  integers (walkable slugs would expose every link); exact alphabet/algorithm is the
  builder's. Custom slugs stay out (YAGNI above).
- **(my call)** Rate limiting caps shortens per user (default 20/hour, fixed
  window). Instance-local is acceptable at this scale but must be documented as such
  in the code (horizontal scaling note per the platform's statelessness principle).
- **(my call)** `GET /go/{slug}` uses **302** by default (stated default; builder may
  revisit): a 301 lets browsers cache the redirect and suppresses click recording,
  which would silently undercount the one metric this project exists to show.

### Repository layout and wiring

- **(human)** `/projects/tinyurl` contains:
  - `service/` — Spring Boot resource server (see Auth below); validates
    Identity-issued JWTs; contains no Identity-specific code (no GitHub/Keycloak
    knowledge — issuer and JWKS URIs are configuration).
  - `microfrontend/` — one Angular app that both exposes `card@1.0.0` via Module
    Federation **and** serves the full shortener UI, openable in its own tab.
  - `project.manifest.yaml` at the project root.
- **(my call)** Gradle: `include("projects:tinyurl:service")` in `settings.gradle.kts`
  (the scaffold generator's exact convention), applying
  `supportfolio.spring-service-conventions`; Java package root
  `com.supportfolio.tinyurl`, package-by-feature.
- **(my call)** Nx: project name `tinyurl-microfrontend` (the scaffold convention
  `<name>-microfrontend`), generated standalone/CSS/Jest like the fixture, under
  `projects/tinyurl/microfrontend`. Using `tools/plugins/project-scaffold` to
  generate the skeleton or hand-scaffolding it is the builder's choice; evolving the
  generator is out of scope.
- **(my call)** Ports (verified unused today; existing: 8080 shell gateway, 8081
  identity, 4200 shell host dev, 4301 fixture dev — removed this plan):
  - tinyurl-service: **8082**
  - tinyurl-microfrontend dev server: **4201**
  - dev PostgreSQL: **5432** (localhost only)
- **(my call)** Extra project files: `projects/tinyurl/docker-compose.yml` (dev DB only), `projects/tinyurl/Dockerfile` (local image), and `docker-compose.demo.yml` for the showcase stack, as the builder sees fit.

### API surface (my call on exact shapes; refinable by the builder)

- `POST /api/links` — auth required. Body `{"targetUrl": "..."}`. Validates at
  creation: absolute `http`/`https` only, host present, no embedded credentials
  (`user:pass@`), and a creation-time DNS resolution that rejects loopback,
  private, and link-local destinations. Success → `201` with
  `{slug, targetUrl, clickCount: 0, createdAt}`. Failures: `400` invalid URL,
  `401` missing/invalid token, `403` role outside admin|user, `429` over the cap.
- `GET /api/links` — public. `200` with `{links: [{slug, targetUrl, clickCount,
  createdAt}]}` — non-sensitive fields only.
- `GET /go/{slug}` — public. Records a click row, then redirects (**302** default)
  to the stored target. Unknown slug → `404`.
- The service publishes its own OpenAPI spec from the running application
  (CODING_STANDARDS.md requirement).

### Datastore

- **(human)** PostgreSQL, database-per-service. No other project shares TinyURL's
  database or schema.
- **(human)** In dev: a single Postgres container via Docker Compose just for
  TinyURL's DB (`projects/tinyurl/docker-compose.yml`, localhost:5432, dedicated
  volume, database `tinyurl`). Its credentials are local-dev-only defaults for a
  localhost-bound container; every other environment's credentials are env-only
  secrets, never committed (GOVERNANCE.md).
- **(human)** Schema shape (builder may refine DDL, keeping both tables and the
  row-per-click rule):
  - `links (id PK, slug UNIQUE, target_url, created_by, created_at)`
  - `link_clicks (id PK, link_id FK → links, clicked_at)`
- **(my call)** Schema managed by explicit versioned migrations (default Flyway;
  verify-before-pin applies), not silent `ddl-auto`.
- **(ruling)** Flyway runs at app boot, so a fresh database — including the prod
  one below — converges to the current schema on first start.
- **(ruling)** The prod datastore ships with the project: `projects/tinyurl/deploy/`
  includes TinyURL's own Postgres workload — a StatefulSet + a small PVC (1Gi
  default) + a secret *template* (credentials env-only, never committed). The
  successor cluster plan really only creates the cluster, wires DNS/TLS, and
  flips CD on — it must not have to invent the database. Resilience expectation:
  the service must still answer `/actuator/health` liveness sensibly while the DB
  is briefly unreachable (liveness vs readiness split; the exact probing is the
  builder's — see Left to the Builder).

### Microfrontend, card, and the fixture swap

- **(human)** One app serves both purposes: it exposes `./card` (Module Federation)
  for the shell grid **and** runs the full shortener UI at `/` in its own tab.
- **(my call)** The card component implements `RemoteCardComponent`
  (inputs `title`, `description`, `features`, `openUrl`; default export), delegates
  rendering to the shared `CardComponent` and re-emits its `open` output, exactly
  as the fixture does (the shell's wrapper wires the open action itself).
  Visual consistency comes free from the shared card; exact copy
  (title/description/features text) is the builder's.
- **(ruling)** The card module must NOT tag its own root with
  `data-testid="remote-card-tinyurl"`: the shell's `RemoteCardHostComponent`
  wrapper already emits exactly that id, and only when the remote actually
  loaded, so duplicating it would break the strict-mode E2E. Instead the card
  carries its own distinguishing content marker (a builder-named testid or text
  the fallback `CardComponent` never renders); the swap E2E asserts the wrapper
  id plus that real-card signal.
- **(my call)** The Module Federation config mirrors the fixture's hard-won rulings
  (do not relearn them): `withModuleFederationPlugin` in
  `webpack.config.js`/`webpack.prod.config.js`; `name: 'tinyurl'`;
  `library: { type: 'var', name: 'tinyurl' }` (classic container — the host loads
  remote entries via a `<script>` tag); `exposes: { './card': ... }`; shared via
  `shareAll({ singleton: true, strictVersion: true, requiredVersion: 'auto' })`;
  `output.scriptType = false` (classic scripts, or the runtime's `import.meta` breaks
  the remote before it registers).
- **(human)** The real TinyURL card REPLACES the identity-card fixture as the
  shell's proof of dynamic remote loading. The fixture is deleted when the real
  card lands. Full swap checklist (each is in scope; missing one breaks CI):
  - Delete `platform/shell/testing/identity-card/` and
    `tools/validate-shell-fixtures.spec.ts`.
  - Dev registry `platform/shell/config/remote-registry.json`: remove the
    `identity` entry, add the `tinyurl` entry (shape below). Consequence: the dev
    grid shows exactly one project card (TinyURL) until project #2 lands.
  - Shell `application.yaml` trusted-origins default: `http://localhost:4301` →
    `http://localhost:4201` (still env-overridable; TinyURL's origin must be
    trusted or the shell drops the entry — the registry is data, the allowlist is
    configuration).
  - `.github/workflows/platform-ci.yml`: `frontend-build` swaps `identity-card` →
    `tinyurl-microfrontend` in the lint/test projects list and the remote build
    step; `shell-e2e` is unchanged in name.
  - Shell E2E re-pointed: `platform/shell/host-e2e/playwright.config.ts` serves
    `tinyurl-microfrontend` on 4201 instead of the fixture on 4301;
    `platform/shell/host/public/e2e/remote-registry.json` points at
    `http://localhost:4201/remoteEntry.js`; the test asserts
    `project-card-tinyurl`, the wrapper's `remote-card-tinyurl`, and the card's
    own real-card content signal (never a duplicate wrapper id — see the card
    ruling above).
  - `platform/shell/README.md` run order: fixture step becomes the tinyurl dev
    server.
  - No shell host code or bundle change anywhere — the swap must be achieved with
    registry data + configuration only. That is the point being proven.
- **(human)** The card's Open action opens the app in a new tab at TinyURL's own
  origin (dev: `http://localhost:4201`) — where its own login is reachable directly.

### Auth

- **(human)** TinyURL includes the shared auth library from `shared-ui-lib`
  (`LoginPageComponent`, `AuthCallbackComponent`, `AuthService`/`AuthTokenStore`,
  `authInterceptor`, `provideAuth`) — its own login page and callback route, same
  Identity service, same JWT.
- **(my call)** `provideAuth` config: `identityLoginBaseUrl` defaults to
  `http://localhost:8081` (dev: login is a top-level navigation straight to
  Identity), `apiBaseUrl: ''` (same-origin token exchange and API), `callbackPath:
  '/auth/callback'`.
- **(ruling)** Prod auth config is in scope: a production environment file
  override sets `identityLoginBaseUrl: ''` (relative — `/auth/login` then resolves
  same-origin through the tinyurl-service proxy), and the production build
  consumes the override via standard Angular file-replacement. The shell carries
  the identical latent gap today (`provideAuth()` with no args bakes the dev
  Identity base into every configuration); fixing the shell is NOT this plan's
  work — recorded here as a known deferred item for whichever plan packages the
  shell (the cluster/infra plan).
- **(my call)** Dev-server proxy: `/api/token` (and `/auth/login`, harmlessly) →
  `http://localhost:8081`; `/api/**` → `http://localhost:8082`. The bearer interceptor
  attaches the token only to same-origin `/api/` calls (never `/api/token`), so the
  business API rides the proxy in dev and is same-origin in prod.
- **(my call)** Dev runtime: Identity must be started with
  `http://localhost:4201` in `SUPPORTFOLIO_IDENTITY_REDIRECT_ORIGINS` (documented in
  the project README, like the shell's).
- **(ruling)** The service's anonymous surface — its `permit-paths`, matching the
  single prod image — is explicit: `/` and the app's SPA client routes (including
  `/auth/callback`, which the own-login flow lands on; all forward to
  `index.html`), hashed static assets, `/remoteEntry.js` and its chunks,
  `GET /api/links`, `GET /go/**`, `/actuator/health` (+ the readiness endpoint),
  and the API docs (`/v3/api-docs` + the docs UI; exact paths verified against
  the chosen springdoc version). The docs call is deliberate: the repo is public
  on GitHub, so the published API contract discloses nothing not already readable
  in source — and a browsable contract is showcase value. Everything else
  requires authentication — and the whole list is enforced by a matrix
  integration test (see Acceptance Criteria), not merely reviewed.
- **(my call)** The service is a plain OAuth2 resource server via
  `platform:shared-spring-starter` (same wiring as the shell). The starter's
  `permit-paths` are path-only and method-agnostic (verified), so the
  `GET`-public/`POST`-authenticated split on `/api/links` needs a method-aware
  public rule — extend the shared starter minimally (e.g. a `permit-get-paths`
  list, defaulting empty so existing consumers are unchanged), as a
  shared-harness change that benefits every later project, never a TinyURL-local
  fork of the chain. `csrf-ignore-paths: /api/links` (the only state-changing,
  bearer-authenticated endpoint). JWK-set/issuer URIs are env-overridable
  configuration.

### Pipeline: demo-ready by construction (human)

> Amended 2026-11-18: the Oracle/k3s/arm64/GHCR deployment surface and CD wiring are superseded by the local Docker Compose + Cloudflare Quick Tunnel showcase model. See `2026-11-18-showcase-deployment-design.md`. Long-term hosting remains an open question.

- Committed and **run** (no cluster needed): a `tinyurl-ci.yml` entry calling the harness
  reusable workflows — `backend-ci.yml` (`project-path: projects/tinyurl/service`) and
  `frontend-ci.yml` (`project-name: tinyurl-microfrontend`) — plus a local Docker image build
  step. The image is built for `linux/amd64` only; the Dockerfile does NO compilation (it only
  copies built artifacts), and `npx tsx tools/prod-bundle-gate.ts` runs against the production
  bundle to ensure `localhost:8081` never ships.
- **(builder-check follow-up)** The demo stack is exercised at merge time: the `demo-stack` job
  builds the platform and TinyURL images, starts `docker-compose.demo.yml`, and runs the
  Playwright demo login E2E against `http://localhost:18080`. The secret template is substituted
  with CI dummy values — no real credential ever exists in CI.
- **(builder-check follow-up)** The prod login flow is CI-proven, not merely built: the local
  demo image runs alongside the demo Identity container (no GitHub involved) and drives the
  complete login flow through the gateway proxy — anonymous browse works, shortening redirects
  to login, the demo token exchange succeeds, and a shortened link works end to end. A static
  build gate fails the build if the production bundle contains `localhost:8081`.
- **(ruling)** This plan does NOT write the shell's remote-registry entry: the registry file has
  no production home until the shell itself is packaged (deferred with the shell's own packaging).
  After a future real deploy, making the card appear on the *production* shell grid is completed by
  the hosting plan, which must also add TinyURL's prod origin to the shell's trusted-origins at
  that time. The dev swap story above is unchanged: the dev registry is the committed sample file.
- Required-check list changes — including the proof jobs above — go through
  `tools/branch-protection.ts` and the manual CLI re-apply (ACTIVATION.md step 3 — PUT against the
  existing ruleset id, never POST).

### Versions### Versions

- **(human)** Same pins as the current workspace — do not bump Angular or Spring
  inside this plan: Java 17, Spring Boot 4.1.1 (`gradle/libs.versions.toml`), Angular
  `~22.2.3`, Nx 23.3.x, `@angular-architects/module-federation` `^22.0.0`, webpack
  pinned 5.111.0, Playwright `^1.64.1`.
- **(human)** Anything new (PostgreSQL driver, Flyway, springdoc/OpenAPI, Testcontainers, the Postgres image tag, and Playwright action versions) follows **verify before pin**: read the official release page first, record the verified version in the commit message.

### Rulings absorbed from builder check (traceability)

One line each; the full decision lives in the sections above:

1. Prod database ships with the project (Postgres StatefulSet + PVC 1Gi + secret template in `deploy/`; Flyway at boot; liveness survives brief DB outages — readiness is the DB-aware probe).
2. Prod auth config is in scope (`identityLoginBaseUrl: ''` override via standard file-replacement); the shell's identical latent gap is a recorded deferral, not this plan's work.
3. Image is built for `linux/amd64` for the local demo stack; the Dockerfile does no compilation — CI builds natively on the amd64 runner and the image only packages artifacts.
4. This plan's deploy workflow does NOT write the shell's remote-registry entry — the registry's production home is deferred with shell packaging.
5. The card module must NOT duplicate the shell wrapper's `remote-card-tinyurl` testid — the E2E asserts the wrapper id plus a real-card content signal.
6. The single image's anonymous path list is explicit, and the API docs are public (public repo: the contract discloses nothing not already in source — showcase value).
7. A non-blocking vulnerability scan runs now; build provenance attestation, blocking promote-gates (CVE threshold, SBOM policy), and GHCR publishing land with a future CD-enabling hosting plan.
8. Flagged call (earlier report): after the fixture swap, the dev grid shows exactly one project card (TinyURL) until project #2 lands.
9. Flagged call (earlier report): the demo stack uses `*.trycloudflare.com` or localhost; the real domain is a future hosting plan's.
10. Builder-check follow-up (2026-10-21): "demo-ready by construction" is CI-proven, not claimed — local compose demo-stack execution, prod-image login E2E with the demo Identity (+ `localhost:8081` bundle gate), and the anonymous-surface matrix test.

## Integration Contracts

Everything below is transcribed from the repo as built (Plans 1–3), not guessed.

### Consumed: Identity auth (Plan 2)

- `GET /auth/login?redirect=<callback>` — 302 to `/oauth2/authorization/github`;
  400 if the redirect origin is not in `supportfolio.identity.redirect-origins`.
- `POST /api/token` body `{"code": "..."}` →
  `{"accessToken", "tokenType": "Bearer", "expiresIn", "principal": {id, login,
  email, displayName, role}}`; unknown/replayed/expired code → 400
  `{"error": "invalid_code"}`.
- `GET /oauth2/jwks` — RS256 JWKS.
- JWT claims: `iss` (Identity's configured issuer), `sub`, `preferred_username`,
  `email`, `name`, `role` (`admin`|`user`, lowercase), `iat`, `exp` (default 3600s).
- Roles: `admin` = `supportfolio.identity.admin-login`; `user` = in
  `supportfolio.identity.allowlist`; everyone else is denied at login and never
  receives a token.

### Consumed: shared-spring-starter (Plan 2/3)

`supportfolio.security.resource-server.enabled`, `.jwk-set-uri`, `.issuer-uri`,
`.permit-paths`, `.csrf-ignore-paths` — the same properties the shell uses.
Verified limitation: `permit-paths`/`csrf-ignore-paths` are path-only,
method-agnostic rules (see Auth above for the method-aware extension this plan
needs).

### Consumed: shared-ui-lib

- `CardComponent` — inputs `title`, `description`, `features: string[]`, `openUrl`;
  output `open: EventEmitter<void>`.
- `RemoteCardComponent` — `{title, description, features, openUrl}`; the exposed
  `./card` default export implements it.
- Auth library — `provideAuth(config)`, `AuthService` (login / completeLogin /
  logout / consumeReturnUrl), `AuthTokenStore` (sessionStorage, tab-scoped),
  `authInterceptor` (bearer only on same-origin `/api/` minus `/api/token`).
- `RemoteRegistryService` — used by the shell, not by TinyURL.

### Consumed: shell remote registry + validation (Plan 3, as built)

- `GET /api/remote-registry` →
  `{"projects": [{id, displayName, shortDescription, features[], openUrl,
  exposedModules: [{name, version, remoteEntry}]}]}`; registry failure → 503
  `{"error": "registry_unavailable"}`. The file is hot-read on every request.
- Registry validation the TinyURL entry must survive, or it is silently dropped:
  `id` matches `^[a-z0-9][a-z0-9-]*$`; `displayName`/`shortDescription` non-blank;
  `openUrl` absolute http(s); `exposedModules` non-empty and contains `card`;
  `version` matches `^\d+\.\d+\.\d+$`; `remoteEntry` absolute http(s) whose
  scheme+host+port exactly match a trusted origin.
- The dev registry entry for TinyURL: `id: "tinyurl"`, `displayName: "TinyURL"`,
  short description + features (builder's copy), `openUrl:
  http://localhost:4201`, `exposedModules: [{name: "card", version: "1.0.0",
  remoteEntry: "http://localhost:4201/remoteEntry.js"}]`.
- The registry's production home (and TinyURL's prod trusted-origin entry) is
  deferred with the shell's own packaging — see Pipeline.

### Consumed: manifest schema + validation CI

`projects/tinyurl/project.manifest.yaml` must validate against
`platform/harness/manifest-schema/project.manifest.schema.json`: required `id`,
`displayName`, `shortDescription`, `features`, `exposedModules` (≥1, one named
`card`), `pipeline.stages` (string array), `environments` (string array). The
schema permits additional properties — the manifest carries `openUrl` too (the
fixture did the same). CI already runs
`npx tsx tools/validate-all-manifests.ts projects --fail-on-invalid`, so the new
manifest is covered automatically once it exists under `projects/`.

### Consumed: harness reusable CI workflows

`platform/harness/workflows/backend-ci.yml` (workflow_call input `project-path`) and
`frontend-ci.yml` (input `project-name`). Whether the backend invocation works
as-is for a subproject of the composite build is verified at plan time — adjust the
reusable workflow if needed (it is shared harness code, so change it for every
project, not just TinyURL).

### Produced

- TinyURL's API contract (shapes above) + OpenAPI from the running service.
- The `card@1.0.0` module + registry entry + manifest.
- The local Docker image and the `demo-stack` CI job (demo-ready, unexecuted against a real cluster).

## Left to the Builder

Deliberately undecided; reasonable defaults stated, flag any deviation:

- Exact schema DDL (UUID vs bigint ids, indexes, `created_by` as JWT `sub`).
- Card copy/visual details (the shared card does the design; keep it consistent).
- Test strategy granularity — but the priced security tests below are mandatory,
  the browser E2E for the swap is mandatory, and production builds
  (`npx nx build tinyurl-microfrontend`) must pass before UI tasks close
  (retrospective standing item).
- 302 vs 301 — default 302 (decided above).
- Slug generation algorithm (unguessable, collision-safe retry).
- Rate-limit mechanism and exact numbers (default 20/hour fixed window).
- CI datastore for service tests — default Testcontainers PostgreSQL (GitHub
  ubuntu runners and the dev machine both have Docker).
- Liveness vs readiness probing detail: the service must answer liveness while
  the DB is briefly unreachable (ruling 1 sets the expectation; the exact
  actuator group/endpoint split and DB-dependency wiring are the builder's).
- CI verification-infrastructure specifics: the local compose bring-up, the demo Identity container's implementation, and how each proof job (demo-stack E2E, prod login E2E, matrix test) is wired — all verify-before-pin; the outcomes they must prove are the acceptance criteria, which stay fixed.
- The card's real-card content-marker id for the swap E2E (builder names it;
  anything the fallback `CardComponent` never renders works).
- The copyable short-link display origin (env-provided public base; dev default
  `http://localhost:8082`).
- k8s manifest details beyond the named workloads (replica count 1, modest
  resource limits).

## Acceptance Criteria

Phrased as what a reasonable person gets; each is verifiable:

1. On the shell grid (dev), TinyURL's card appears by editing only the registry
   file and shell configuration — the shell host's code and build are untouched,
   and the card is the real remote (the shell wrapper's remote-only id
   `remote-card-tinyurl` is present, plus the card's own content signal), not the
   fallback.
2. Clicking the card's Open action opens the full app in a new tab at
   `http://localhost:4201`, which works end to end while logged in: browse list
   loads, shortening a URL produces a working short link, and the link appears in
   the public list with an incrementing click count.
3. The app has its own login page reachable directly at its own origin; logging in
   from there (via Identity/GitHub) returns to where the user was, with no token
   in storage on denial.
4. An anonymous visitor can browse links and click counts, and follow short links;
   an anonymous or over-cap shorten attempt is rejected (401/403/429), never
   silently created.
5. A matrix integration test boots the service with production-like config and
   asserts the exact expected status for every path × method pair — public
   entries (SPA routes incl. `/auth/callback`, static assets, `remoteEntry.js`,
   `GET /api/links`, `GET /go/**`, `/actuator/health` + readiness, the public API
   docs) answer 200/302, everything else answers 401 — so nothing is
   accidentally public.
6. A short link `http://localhost:8082/go/{slug}` redirects to the created target
   and each follow bumps the click count; a made-up slug 404s.
7. Invalid targets (non-http(s), embedded credentials, private/loopback
   destinations) are rejected at creation with a typed 400 — before anything is
   stored.
8. The identity-card fixture is gone: directory deleted, no `identity` entry in the
   dev registry, and every swapped touchpoint (CI lists, shell E2E, README,
   trusted-origin default, fixture spec file) is updated — all existing required
   checks green.
9. `projects/tinyurl/project.manifest.yaml` validates against the committed schema
   (the `validate-manifests` check passes with it in place).
10. The prod login flow is proven in CI: the production image runs beside a stub
    Identity (a valid JWKS, no GitHub) and the complete flow works through the
    image's own proxy — anonymous browse, shorten-redirects-to-login, token
    exchange, and a shortened link end to end — and the build fails if the
    production bundle contains `localhost:8081`.
11. The demo stack starts from `docker-compose.demo.yml` via `scripts/demo.ps1` (core stack
    and tunnel profile) and passes the demo login E2E on every PR.
12. TinyURL is reachable through the shell gateway at `/apps/tinyurl/` and short links resolve
    to absolute URLs on the demo host (`http://localhost:18080/go/{slug}` through the tunnel),
    incrementing the click count on each redirect.
13. The demo login flow works end-to-end through the gateway proxy without GitHub (using the
    demo Identity container), and a merged PR leaves the local image build, compose stack, and
    proof jobs reviewed — nothing executed against a real cluster, nothing deployed to prod.
14. The running service serves its own OpenAPI spec and docs UI anonymously (the
    public-repo rationale above); `./gradlew build` (incl. Spotless), the
    frontend lint/test/build, and the shell E2E all pass.
15. The production frontend build consumes the `identityLoginBaseUrl: ''`
    override via standard file-replacement, so login resolves same-origin through
    the tinyurl-service proxy in the image; the dev default stays
    direct-to-Identity.

## Constraints

- **Carried from Plan 3 (unchanged):** remotes never receive auth tokens; CSP/
  trusted-origin allowlist governs remote origins (TinyURL's origin added via
  configuration, never via registry data); Module Federation singletons for
  Angular core/common/router/forms + rxjs (`singleton: true, strictVersion: true,
  requiredVersion: "auto"`); no secrets committed; no PII in logs/telemetry;
  conventional commits; standalone components, one component per file, Prettier;
  package-by-feature Java, one public class per file, constructor injection only,
  Google Java Format via Spotless; plural REST nouns, verbs out of paths.
- **Governance:** every change arrives via PR linking its Issue; merge-to-main and
  promote-to-prod are never bypassed; this is an auth/input-touching plan, so the
  PR carries an OWASP checklist item priced as: URL validation on shorten,
  open-redirect/slug-enumeration handling on `/go/{slug}` (target fixed at
  creation, unguessable slugs), rate limiting, and public-field exposure. These
  tests are mandatory, not aspirational. Release guardrails per ruling 7: a non-blocking vulnerability scan lands now; build provenance attestation, GHCR publishing, and blocking promote-gates (CVE threshold, SBOM policy) land with a future CD-enabling hosting plan.
- **Retrospective standing items folded in (Plan 3 entry):** run the production
  build on UI work before closing the task ("tests green" ≠ done); keep one
  real-browser E2E for genuinely new runtime behavior (the fixture→real-card swap
  is this plan's); deep review is mandatory for this High-shape,
  security-sensitive plan; write `Ruling:` ledger lines at the moment of any
  deviation; invoke systematic-debugging as soon as an integration problem
  survives one failed hypothesis; write multi-block config (MF webpack, gateway yaml, compose files) in smallest-verifiable increments, never one large pass.
- **Budget:** free-tier only (platform spec); there is no new recurring surface for the showcase (all images are built locally).

## Scope Boundary

Explicitly NOT in this plan: creating the cluster/VM/domain, executing any deploy,
DNS/TLS, flipping CD on, shipping Grafana telemetry, extracting the scaffold
template, the admin-triage app, a second project, and every deferred product
feature listed in Non-Goals.

> Amended 2026-11-18: the Oracle/k3s/arm64/GHCR deployment surface and CD wiring are superseded by the local Docker Compose + Cloudflare Quick Tunnel showcase model. See `2026-11-18-showcase-deployment-design.md`. Long-term hosting remains an open question.

Successor: a **future real-hosting plan** picks up every deferred infrastructure
item — domain, TLS, VPS/cloud, CD execution, Grafana Cloud telemetry, the shell's
own packaging (including the shell's prod auth-config gap and the registry's
production home, i.e. wiring TinyURL's prod registry entry + trusted origin), and
the blocking promote-gates (CVE threshold, SBOM policy) — and its headline
deliverable is the **first deploy to prod**. TinyURL ships demo-ready by
construction precisely so that plan flips it on instead of reworking it.
