# Roadmap

| Plan | Scope | Status | Retro |
|---|---|---|---|
| 1 — repo/harness foundations | monorepo, conventions, shared libs, CI workflows, governance | done (merged, Oct 2026) | retro: exempt — pre-system |
| 2 — Identity service | GitHub OAuth → JWT, provider port, resource-server starter | done (PR #17) | retro: exempt — pre-system |
| 3 — shell/gateway | hot-read registry, CSP, Angular host, shared card | done (PR #17) | 2026-10-20/Plan 3 |
| 4 — TinyURL | full project slice, deploy-ready artifacts | done (PR #20) | 2026-10-24/Plan 4 |
| 5 — showcase deployment | local compose + Cloudflare Quick Tunnel, `/apps/<id>/` hosting, demo login | done (PR #47) | 2026-11-18/Plan 5 |
| 6 — telemetry | per-service actuator/Prometheus metrics on management ports + observability compose profile; triage dashboard & add-new-app dropped | done (PR #49) | 2026-11-20/Plan 6 |
| future — real hosting | domain, TLS, VPS/cloud, CD | not planned |  |

Plan documents live in `docs/superpowers/plans/`; designs in `docs/superpowers/specs/`; learnings in `retrospectives.md`. Update this table when a plan merges.
