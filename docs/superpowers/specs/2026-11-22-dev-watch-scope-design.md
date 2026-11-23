# Design: Dev watch plans start only infrastructure + their own app

Date: 2026-11-22
Status: approved

## Intent & why

The dev scripts must reflect real service boundaries. Today `watch:shell` starts the
TinyURL service and micro-frontend because the shell's dev surface declares
`dependsOn: [identity, tinyurl, telemetry]` in `platform/project.manifest.yaml`. As new
project slices are added, they would silently leak into the shell dev loop too. The
non-negotiable: **`watch:shell` / `build-watch:shell` never starts project (non-infra)
services**; each project slice's watch starts only its own BE+FE and the infrastructure
it actually depends on.

## Goals

- `watch:shell` / `build-watch:shell`: shell BE+FE + infrastructure (identity, telemetry,
  compile; postgres only if identity actually needs it).
- `watch:tinyurl` / `build-watch:tinyurl`: tinyurl BE+FE + identity + postgres + compile
  (unchanged behavior).
- When a registered remote is not running, the shell catalog shows its tile as
  **offline/unavailable** instead of an error.
- Adding project #4 requires touching only that project's manifest — not the platform
  manifest's shell dependsOn.

## Non-goals / anti-goals

- No change to prod scripts (`prod:shell`, `prod:tinyurl`) or the demo compose stack.
- No change to e2e (Playwright serves its own dev servers).
- No health-probing of remote entries and no monitoring daemon — offline state is the
  per-remote error-boundary fallback at load time.
- No changes to the registry architecture (see verdict below).

## Architectural verdict (researched, do not disturb)

The existing registry architecture was cross-checked against industry practice (Module
Federation runtime docs, single-spa import-map patterns, Backstage catalog semantics,
webpack MF docs — see session research):

- Manifest-per-app auto-discovery (`projects/*/project.manifest.yaml` scanned by
  `loadProjectManifests`) is the Backstage-style descriptor-per-remote pattern — the
  good variant; a new service registers by adding its own manifest folder.
- The generated registry served by the gateway at `GET /api/remote-registry` already is
  the "registry endpoint with same schema" pattern that static-file setups are told to
  grow into; the file is just its backing store.
- Runtime-dynamic remote loading (`loadRemoteModule` with registry URLs, empty build-time
  remotes map) is standard dynamic-federation practice; CSP trusted origins from the same
  manifest data is sound.

**Conclusion: keep the registry pipeline exactly as is.** The only gap vs. best practice
is the missing per-remote error boundary (item 3 below).

## Approaches considered

1. **Drop tinyurl from shell dependsOn, leave registry as-is.** One-line change, but the
   shell catalog shows a TinyURL tile that errors when opened. Insufficient alone.
2. **Registry follows the plan** (omit not-running apps). Loses the "registered but off"
   signal; rejected.
3. **Health-probe gating.** Research discourages probe-driven hiding as the only
   mechanism (hides incidents). Rejected.
4. **Drop tinyurl from dependsOn + per-remote error-boundary offline tile** — **chosen.**
   Best practice: fail loudly at load time, render an explicit offline/unavailable tile,
   no probing.

## The design

1. **`platform/project.manifest.yaml`**: shell surface
   `dependsOn: [identity, tinyurl, telemetry]` → `dependsOn: [identity, telemetry]`.
   Verify identity's DB needs: if identity requires postgres, keep postgres in the shell
   plan (it is infrastructure); if not, the shell plan drops it. tinyurl's manifest is
   unchanged (`dependsOn: [identity]`, `databases: [postgres]`).
2. **Registry**: no changes — generation inputs, schema, gateway endpoint, CSP wiring all
   untouched. `remote-registry.dev.json` still lists every registered project.
3. **Catalog offline tile** (`platform/shared-ui-lib` / shell-host catalog): where a tile
   loads its remote (`loadFederatedCard` → `loadRemoteModule`), catch the load rejection
   and render the tile as disabled/offline ("offline" or "unavailable" state) instead of
   an unhandled error. Registry-endpoint-down keeps its existing
   `RegistryUnavailableError` path. No pre-flight probes.
4. **Tests**: unit test for the offline tile rendering (shared-ui-lib); plan/fixture
   updates (`tools/fixtures/**`, plan.spec.ts expectations) for the shell plan without
   tinyurl; `npx tsx tools/dev-orchestrator.ts start:plan` dry-run confirms the split.

## What's left to the builder

- Where exactly the catch lives (remote-card-host vs catalog-page vs federated-loader
  wrapper) — pick the spot consistent with existing patterns.
- Offline tile visual treatment (disabled vs. badge) consistent with shared-ui-lib.
- Whether postgres stays in the shell plan (decided by identity's actual DB dependency).
- Fixture/snapshot files encoding the shell plan's process list.
