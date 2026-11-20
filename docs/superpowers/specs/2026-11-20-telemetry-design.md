# Plan 6 — Telemetry design (scope narrowed 2026-11-20)

**Status:** Approved by human partner 2026-11-20 (approaches 1+2 below; open decisions resolved
the same day — see "Decisions"). Scope narrowed from the roadmap entry: the triage dashboard and
the "Add new app" flow are **dropped** — Plan 6 is telemetry only.

## Intent and why

The supportfolio stack (shell gateway, identity, TinyURL service) is live behind a Cloudflare
Quick Tunnel with no way to see how it is doing: only TinyURL exposes `/actuator/health`, and
the gateway and identity have no `management:` block at all. The operator wants to monitor the
already-live applications with standard telemetry — metrics they can scrape or graph — without
building bespoke dashboards or admin flows.

## Decisions (human partner, 2026-11-20 — "go with your picks")

1. **All actuator endpoints — health included — live on the per-service management port** (option
   (a)). Compose healthchecks, the identity Dockerfile `HEALTHCHECK`, and the main-port health
   tests are retargeted to the management port in the same tasks.
2. **Observability profile is PR-blocking as a separate small CI job** (own timeout), not inside
   the existing `demo-stack` job.
3. **`scripts/demo.ps1` gains an `-Observability` switch**; behavior without the flag is unchanged.
4. **Management ports are env-overridable and distinct by default** — gateway 9091, identity 9092,
   TinyURL 9093 — so host-run `bootRun` of multiple services cannot collide.

Builder-check minor calls (settled, recorded here): dependency artifact is
`io.micrometer:micrometer-registry-prometheus` (Boot 4.1 manages it), added in the three service
build files (not the convention plugin); tests set `management.server.port=0` and use
`@LocalManagementPort` / `@LocalServerPort`; the management context is **unauthenticated by
design** (never published, never proxied) with a yaml comment saying so; stale main-port
`/actuator/health` permit entries are dropped in the same task that moves health; `application`
common tag via per-yaml `management.metrics.tags.application`; Dockerfiles gain `EXPOSE` for the
management port (documentation only); Grafana runs an anonymous viewer with the admin password
from env.

## Goals

- All three Spring services expose Spring Boot Actuator health (with liveness/readiness groups)
  and Prometheus-format metrics (`/actuator/prometheus`) on a **management port**.
- Metrics endpoints are **not reachable through the public tunnel or the gateway's public routes**;
  they live on a separate management port that is never published in compose and never proxied.
- The demo compose gains an optional `observability` profile: Prometheus scraping the three
  services plus Grafana with a pre-provisioned datasource and one working dashboard.
- The observability profile is inert by default; `.\scripts\demo.ps1` unchanged behavior without it.

## Non-goals

- The triage dashboard (dropped by the human partner).
- The "Add new app" flow (dropped — belongs to the abandoned software-factory concept).
- Alerting, log aggregation, distributed tracing.
- Any admin role-gated UI; `ROLE_ADMIN` remains issued-but-unenforced (unchanged).
- Metrics for the Angular frontends (browser-side telemetry is out of scope).

## Anti-goals

- No metrics endpoint publicly exposed via the tunnel.
- No second copy of security headers/CSP outside the shell gateway.
- No coupling into `demo-login`/seeder code paths.
- No silent divergence between committed config and the running stack.

## Approaches considered

1. **Actuator + Prometheus registry, observed externally (CHOSEN, base).** Add
   `micrometer-registry-prometheus` and `management:` blocks to the three services; observe with
   any Prometheus. Least code, standard practice.
2. **Same + profile-gated observability stack in compose (CHOSEN, additive).** Prometheus +
   Grafana containers behind the `observability` profile with pre-wired scrape config and one
   dashboard. Real graphs out of the box; two more containers and dashboard files to keep honest.
3. **Admin-gated telemetry page in the shell (REJECTED).** Bespoke UI for what Grafana gives free;
   drags the dropped dashboard idea back in.

## Design

### Services (approach 1)

- Dependencies: `micrometer-registry-prometheus` added in the three services' build files
  (`io.micrometer:micrometer-registry-prometheus`, version-managed by the Boot plugin). Actuator
  itself is already provided to every Spring service by the convention plugin
  (`build-logic/.../supportfolio.spring-service-conventions.gradle.kts`).
- **All actuator endpoints move to a per-service management port** (Decision 1). Because Spring
  Boot moves the whole actuator when the management port moves, health moves with it — the compose
  healthchecks, the identity Dockerfile HEALTHCHECK, and existing main-port health tests are
  retargeted in the same tasks. Ports are env-overridable with distinct defaults (Decision 4):
  gateway `SUPPORTFOLIO_SHELL_MANAGEMENT_PORT:9091`, identity `..._MANAGEMENT_PORT:9092`,
  TinyURL `..._MANAGEMENT_PORT:9093`. Compose never publishes management ports; the tunnel cannot
  reach them.
- Exposure: `health,prometheus,info` on the management context, `probes.enabled: true` with
  liveness/readiness groups like TinyURL's existing precedent.
- Common metrics tags: per-yaml `management.metrics.tags.application` per service.
- The management context is unauthenticated **by design** (never published, never proxied) —
  a yaml comment states this so it is not mistaken for an oversight.
- Public surface change: `/actuator/health` no longer exists on the main ports; the stale
  permit entries (gateway `permit-paths`, identity `SecurityConfig`) are dropped in the same
  task, and the three existing test classes are retargeted to the management port.
- Tests (RED→GREEN per service): management port serves `/actuator/prometheus` (200,
  prometheus content-type) and `/actuator/health` groups; main port does **not** serve
  `/actuator/prometheus` (404). Tests set `management.server.port=0` and use
  `@LocalManagementPort` / `@LocalServerPort`.

### Compose observability profile (approach 2)

- `docker-compose.demo.yml` gains an `observability` profile:
  - `prometheus` (config: scrape jobs for the three services on their management ports over the
    compose network), published only on `127.0.0.1`.
  - `grafana` published on `127.0.0.1` (host port distinct from 9090–9093), datasource
    pre-provisioned to the Prometheus container, one dashboard showing per-service JVM +
    HTTP-request metrics and health. Anonymous viewer; admin password from env.
- Healthchecks are retargeted to the management ports (Decision 1); `depends_on: service_healthy`
  chains keep working.
- `scripts/demo.ps1` gains an `-Observability` switch that brings the profile up; without the
  flag the script behaves exactly as today (Decision 3).
- The tunnel profile is untouched; observability is never published through it.

### Verification

- Per-service endpoint tests (above).
- Compose smoke: the existing `demo-stack` job keeps passing unchanged; a **separate PR-blocking
  CI job** boots the `observability` profile (own, shorter timeout) and asserts Prometheus
  reports all three scrape targets up (Decision 2).
- `gradlew build` gate run in-task for every yaml-touching task (standing retro item).

## What's left to the builder

- Exact management-port env-var naming per existing conventions.
- Grafana dashboard JSON layout and which panels make the cut.
- Whether identity gets its own health-group names beyond the TinyURL precedent.
