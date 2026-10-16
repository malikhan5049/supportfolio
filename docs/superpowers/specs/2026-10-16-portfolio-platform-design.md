# Portfolio Platform — Design

Status: Draft, pending human approval
Date: 2026-10-16
Owner: you (repo owner / sole admin)

## Intent and Why

A personal portfolio that does two jobs at once: it shows recruiters and
hiring managers a working, non-trivial system (not just a list of repos),
and it gives you one real home for projects that today don't exist
anywhere together — you're starting from zero. The chosen shape is an
"app store for your own projects": a shell that lists every project as a
card, each card backed by a real, independently running
microservice + microfrontend pair, each one open-able in its own tab.

Beyond the product itself, you want a repeatable SDLC harness — triage,
plan, implement, test, deploy — with you (the admin) as the
human-in-the-loop at the decision points, so adding the 2nd, 10th, or
50th project moves at the same pace as the 1st.

## Goals

- A shell/gateway that aggregates per-project microfrontends as cards:
  title, short description, key features, an "Open" action (new tab),
  Play Store-style functionality, daily.dev-style visual design
  (card-based, content-forward, clean).
- Two personas:
  - **Admin** (you): sees post-production telemetry per project, and a
    triage view merging feature pipeline (with delivery dates),
    outstanding issues (with assignees), and the ability to add new
    features, fixes, or entirely new apps. Admin can trigger
    "Start implementation" / "Fix issue" / "Add new app" and the system
    does plan → implement → PR → CI → deploy, stopping at defined
    human-approval checkpoints.
  - **User**: once granted access, browses and opens whatever is
    production-ready. No visibility into triage/telemetry.
- A harness that is explicitly split into **shared** (platform-level:
  reusable CI/CD workflows, shared UI library, shared Spring Boot
  starter, shared auth, scaffold template for new projects) and
  **distinct** (per-project manifest that opts into whichever shared
  pieces apply), so each new project is mostly configuration, not
  new plumbing.
- Each individual project is architected as if it could become a real
  commercial product later: independently deployable, independently
  scalable, with its own datastore, and realistically extractable into
  its own repo without a rewrite. The shell/gateway itself never needs
  that scalability — it's a thin aggregator/router.
- Zero or near-zero recurring cost (personal project, free/freemium
  budget only).

## Non-Goals (for now)

- Supporting more than one project beyond phase 1 (shell/gateway +
  TinyURL). More projects come later, through the same harness.
- Messaging/event infrastructure (Kafka, etc.) — not needed until a
  project genuinely requires async communication.
- Multi-region, high-availability infrastructure. This is a personal
  project on a single small VM; "commercial-grade potential" means the
  *architecture* doesn't block scaling later, not that it's load-tested
  today.
- A fully custom-built issue tracker — GitHub Issues/Projects is the
  backlog; the triage UI is a view and trigger surface over it, not a
  replacement for it.

## Anti-Goals

Would count as failure even if it "works":

- A shell that knows anything about a project's internal business logic
  (that breaks independent scalability/extraction later).
- A harness so bespoke to TinyURL that adding project #2 requires
  rewriting the pipeline instead of writing a manifest.
- An auth implementation so tied to GitHub OAuth's quirks that moving to
  Keycloak later means touching every service instead of one
  configuration/adapter.
- Automation that can deploy to prod without a human approval step.

## Constraints

- Solo developer, one local machine, no separate test/prod hardware.
- Free or freemium budget only — every infra choice below was picked
  because it has a genuine forever-free (or no-cost-to-you) tier.
- Superpowers (the agent/skill system doing the planning+implementation
  work) only runs where it's installed today: your local machine. It is
  not something GitHub's cloud runs for you for free.
- Trello is not available in this environment (no Trello MCP/tool is
  configured) — per your standing workflow preference, SDLC artifacts
  (this design doc, and the plan/tasks that follow it) are tracked in
  this repo under `docs/superpowers/` instead, with GitHub
  Issues/Projects as the live backlog.

## Decided Architecture

### Repository topology

One monorepo.

```
/platform
  /shell                shell/gateway app (Spring Cloud Gateway + Angular host)
  /admin-triage          admin-only app: telemetry + triage + trigger actions
  /identity               auth/identity service (see Auth below)
  /shared-ui-lib          Angular library: card component, design system, layout
  /shared-spring-starter  Spring Boot starter: logging, health, security filters
  /harness
    /workflows            reusable GitHub Actions workflows (lint/test/build/deploy)
    /scaffold-template     template used to generate a brand-new project
/projects
  /tinyurl
    /service              Spring Boot microservice
    /microfrontend         Angular remote module
    project.manifest.yaml  opt-in config: pipeline stages, env targets, card metadata
```

Future projects are new siblings under `/projects`. Each one is
structured so it *could* be cut out into its own repo later (own
service, own datastore, own manifest, no imports from other projects)
if it ever needs to stand alone as a commercial product — the monorepo
is an organizational choice for now, not an architectural dependency.

### Shell / Gateway

- Spring Cloud Gateway as the API gateway/router.
- Angular host app using Module Federation to load each project's
  microfrontend as a remote, rendered as a card: title, short
  description, features, "Open" action (new tab). Visual language
  follows daily.dev (card grid, clean typography, content-forward);
  functional model follows Play Store (browse, open, per-app detail).
- The shell contains no project business logic — only routing,
  aggregation, and card rendering.
- **Remote loading is dynamic, not build-time** (my call): the shell
  reads a small remote registry (projectId, remoteEntry URL, card
  metadata) at runtime and loads each microfrontend on demand. A
  project's CD step updates its own registry entry when it deploys.
  This means adding or updating a project never requires rebuilding or
  redeploying the shell — required for the "independently deployable"
  goal to actually hold.
- **Security boundary** (my call, standard practice, revisit if it
  proves insufficient): remotes run in the shell's origin and never
  receive the shell's auth token directly — each remote talks to its
  own backend, which validates its own JWT independently. CSP headers
  restrict which origins can be loaded as remotes. Deeper isolation
  (e.g. iframe sandboxing) is deferred unless a specific project needs
  it.

### Microfrontend sharing foundation (cross-project, not just shell-consumes-card)

No project shares business logic with another today, and the shell only
ever consumes one fixed module per project (the card). But the
underlying Module Federation setup is built as a general mesh, not a
shell-only pattern, so that a future project can expose one of its own
distinct frontend pieces for another project (or the shell) to embed —
without re-architecting anything already built:

- A project's `project.manifest.yaml` can declare more than one exposed
  module (not just `card`), each with a stable name and a semantic
  version (e.g. `tinyurl` exposes `card@1.0.0` today; later it could
  also expose `url-widget@1.0.0` for another project to embed).
- Exposed modules are discovered through the same dynamic remote
  registry already described above — a consumer looks up a module by
  project + name + compatible version range, the same mechanism the
  shell uses for cards.
- **Sharing is opt-in and explicit, never automatic**: a project exposes
  nothing beyond its card until its manifest says otherwise, and a
  consumer must explicitly declare which exposed module it depends on.
  This keeps today's "no shared business logic" reality intact while
  leaving the door open.
- Enabling a cross-project exposure extends the CSP/trusted-remote
  allowlist (see Security boundary above) to cover that specific
  module, not a blanket trust of the whole project.
- Shared runtime dependencies (Angular, RxJS, zone.js) are configured
  as singletons with a consistent version policy across every remote
  and host from day one — the harness's shared Angular/Module
  Federation config template enforces this — so that when a second
  project does start consuming another's exposed module, there's no
  duplicate-framework-instance breakage to retrofit.
- A consumer gets compile-time type safety against what it's embedding
  via a small published type-definitions package per exposed module
  (generated from the exposing project), while the actual code still
  loads at runtime through Module Federation — so breaking changes show
  up as a build-time type error, not a runtime surprise.

### Personas and access

- **Admin**: you, identified by your GitHub account. Sees admin-triage
  app: post-prod telemetry (per project) and the triage board (features
  in pipeline with delivery dates, outstanding issues with assignees,
  "Add new feature/fix/app" actions, "Start implementation"/"Fix issue"
  triggers, environment-promotion actions).
- **User**: a GitHub account you've explicitly allowlisted. Can browse
  and open projects marked production-ready. No triage/telemetry access.
- Role is resolved at login (owner vs allowlisted vs anonymous/denied).

### Auth (abstracted, swappable)

Goal: start on GitHub OAuth, be able to move to Keycloak later without
touching shell or project code.

- A dedicated **Identity service** (`/platform/identity`) is the only
  thing that talks to the upstream identity provider. Today that's a
  GitHub OAuth App; later it could be Keycloak (a full OIDC provider).
  The provider-specific logic (GitHub's non-OIDC user-info call vs.
  Keycloak's standard OIDC discovery/ID tokens) lives entirely behind
  one internal interface in this service, e.g. an `IdentityProvider`
  port with a `GitHubIdentityProvider` adapter today and a
  `KeycloakIdentityProvider` adapter swapped in later via configuration.
- The Identity service normalizes whatever the upstream provider returns
  into one internal principal shape (user id, email, role), and issues
  its **own signed JWT**. Every other service (shell, gateway, each
  project's service) is a plain OAuth2 **resource server** that only
  ever validates this JWT — none of them know or care whether GitHub or
  Keycloak sits behind it. That's the swap point: changing providers
  later means reconfiguring the Identity service, not the rest of the
  system.
- Login UX: a shared Angular auth library (in `shared-ui-lib`) provides
  the login screen/redirect flow. Each project includes it, so each
  project genuinely has its own login page (a user can land on
  `tinyurl` directly, unauthenticated, and log in right there) while
  reusing one implementation rather than duplicating auth code. The
  same flow is reachable from the shell. Either entry point ends at the
  same Identity service and the same JWT.

### Scalability principle

The shell/gateway is intentionally never built to scale — it's a thin
aggregator. Every project, however, is built as if it might need to
carry real production load one day:

- Database-per-service (no shared schema between projects).
- Stateless services, JWT-based auth (no sticky sessions) so any
  project can scale horizontally independently of the others.
- Each project has its own CI/CD pipeline, container image, and
  deploy/scale configuration (replica count, resource limits) in its
  manifest — a project expecting more load can be given more resources
  or moved to dedicated infrastructure without touching the others.
- Each project owns its own API contract (OpenAPI) so it can evolve, or
  be extracted into a standalone repo/service, independently.

### Environments and infrastructure (free-tier)

- **dev**: your local machine, Docker Compose.
- **test** and **prod**: namespaces on a k3s (lightweight Kubernetes)
  cluster running on an Oracle Cloud **Always Free** Arm VM (4 OCPU /
  24GB RAM, no 12-month expiry, unlike Azure/AWS free tiers).
- Repo is **public** on GitHub (fits a recruiter-facing showcase and is
  the only way to get GitHub Actions environment protection rules —
  required reviewers, wait timers — for free; private repos need a
  paid plan for that).
- GitHub Actions: unlimited minutes on public repos. A **self-hosted
  runner on your own machine** handles anything that needs superpowers
  (plan/implement/scaffold); standard lint/test/build/deploy steps can
  run on GitHub-hosted or self-hosted runners.
- Promotion test → prod is gated by a GitHub Actions environment
  protection rule requiring your approval.
- Telemetry: Spring Boot Actuator/Micrometer per service, shipped to
  Grafana Cloud's free tier (hosted, so it doesn't consume the small
  Oracle VM's resources) and surfaced in the admin-triage telemetry view.

### Harness: triage-triggered automation

1. Admin adds/selects a feature, issue, or "new app" request in the
   triage UI (backed by GitHub Issues/Projects). **Trigger input**
   (my call): "Start implementation" and "Fix issue" operate on an
   existing GitHub Issue picked from the triage board — the trigger
   passes the issue number. "Add new app" has its own small form
   (name, slug, short description, initial feature list) because no
   issue exists yet; submitting it creates a new GitHub Issue tagged
   `type:new-app` from that data, then triggers against it. Every
   triggered action ends up keyed off one GitHub Issue, keeping GitHub
   as the single source of truth for the backlog.
2. Admin clicks **Start implementation** / **Fix issue** / **Add new
   app**. This dispatches a GitHub Actions workflow that runs on the
   **self-hosted runner** on your machine.
3. That workflow invokes the agent (superpowers) to plan and implement
   the change:
   - For a feature/fix: works inside the relevant project folder,
     follows the project's existing manifest and shared conventions.
   - For a new app: runs the harness's scaffold template — generates
     `projects/<app>/` (service + microfrontend + manifest + card
     metadata), wires it into the shell's Module Federation config,
     adds its CI entry calling the shared reusable workflows, and
     registers it on the GitHub Project board — before opening a PR.
4. The agent opens a PR. **Human-in-the-loop checkpoint**: you review
   and merge (or send back for changes).
5. Merge triggers CI (lint, test, build, image push to GitHub Container
   Registry) via the shared reusable workflows, then CD deploys to
   **test**.
6. You review in test, then approve promotion to **prod** via the
   GitHub environment protection rule.
7. Telemetry from prod flows back into the admin triage view.

### Tech stack

- Backend: Java, Spring Boot microservices, Spring Cloud Gateway.
- Frontend: Angular, Module Federation for microfrontends.
- Auth: GitHub OAuth today via a dedicated Identity service issuing its
  own JWT (resource-server pattern), structured to swap in Keycloak
  later without touching shell/project code (see Auth above).
- Backlog/PM: GitHub Issues + GitHub Projects (v2).
- CI/CD: GitHub Actions (hosted runners for standard steps,
  self-hosted runner on your machine for superpowers-driven steps),
  reusable workflows in `/platform/harness/workflows`.
- Infra: Docker Compose (dev), k3s on Oracle Cloud Always Free (test,
  prod), GitHub Container Registry for images.
- Observability: Spring Boot Actuator/Micrometer → Grafana Cloud free
  tier.
- Datastore: one database per project (exact engine decided per
  project — TinyURL's is left to the builder below).

**Versions**: use the current latest stable/LTS release of every tool
(Java, Spring Boot, Angular, Node.js, PostgreSQL, k3s, etc.) at the time
each piece is actually scaffolded — verified against each project's
official release page at that time, rather than pinned here, since a
version pinned today in a design doc is likely to already be stale by
the time it's built.

### Phase 1 scope

Only two things get built in phase 1:

1. The shell/gateway (with the Identity service, shared UI/Spring
   starter libraries, and harness scaffolding/workflows — since these
   are prerequisites every project depends on).
2. One real project: **TinyURL** — shorten a URL, redirect, basic
   click-count analytics. Enough to prove the whole pattern (card on
   shell, own login reachable directly, own pipeline, own test/prod
   deploy, telemetry flowing back to admin triage) without overbuilding.

Admin triage's "Add new app" flow is part of phase 1 (it's part of the
harness), but no second project is actually added through it yet —
that's exercised for real starting in phase 2.

## What's Left to the Builder

Not yet decided; reasonable defaults may be chosen when planning, and
flagged as such:

- Exact datastore engine for TinyURL (e.g., Postgres vs. simpler
  embedded store) and its schema.
- Exact shape of `project.manifest.yaml` (field names/schema).
- Exact GitHub Projects board/column structure backing the triage view.
- Specific metrics captured in the Grafana Cloud telemetry view beyond
  the basics (uptime, error rate, latency, request count).
- Exact self-hosted runner setup/security hardening steps (it runs on
  your personal machine with repo access — scoping, isolation, and
  secrets handling need care).
- Card UI component's exact prop/API shape in `shared-ui-lib`.
- Specific latest-stable tool versions (to be verified at scaffold
  time, not guessed now).
