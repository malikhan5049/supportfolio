# Roadmap

| Plan | Scope | Status |
|---|---|---|
| 1 — repo/harness foundations | monorepo, conventions, shared libs, CI workflows, governance | done (merged, Oct 2026) |
| 2 — Identity service | GitHub OAuth → JWT, provider port, resource-server starter | done (PR #17) |
| 3 — shell/gateway | hot-read registry, CSP, Angular host, shared card | done (PR #17) |
| 4 — TinyURL | full project slice, deploy-ready artifacts | done (PR #20) |
| 5 — showcase deployment | local compose + Cloudflare Quick Tunnel, `/apps/<id>/` hosting, demo login | done (PR #47) |
| 6 — telemetry | per-service actuator/Prometheus metrics on management ports + observability compose profile; triage dashboard & add-new-app dropped | done (PR #49) |
| future — real hosting | domain, TLS, VPS/cloud, CD | not planned |

Plan documents live in `docs/superpowers/plans/`; designs in `docs/superpowers/specs/`; learnings in `retrospectives.md`. Update this table when a plan merges.
