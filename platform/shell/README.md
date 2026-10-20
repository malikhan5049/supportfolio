# Shell / Gateway

The Supportfolio shell: a Spring Cloud Gateway Server MVC that fronts the Identity
service, serves the SPA host, publishes the remote registry, and applies CSP from a
trusted-origin allowlist. It contains **no project business logic**.

## Run locally (dev)

```bash
# 1. Identity (needs the Plan 2 env vars: GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET,
#    SUPPORTFOLIO_IDENTITY_ISSUER, SUPPORTFOLIO_IDENTITY_ADMIN_LOGIN,
#    SUPPORTFOLIO_IDENTITY_ALLOWLIST, SUPPORTFOLIO_IDENTITY_REDIRECT_ORIGINS,
#    SUPPORTFOLIO_IDENTITY_JWT_PRIVATE_KEY_PEM)
./gradlew :platform:identity:bootRun

# 2. The fixture card remote (serves remoteEntry.js on 4301)
npx nx serve identity-card --port 4301

# 3. The shell gateway (three SUPPORTFOLIO_SHELL_* env vars, defaults shown)
./gradlew :platform:shell:bootRun

# 4. The SPA host (proxies /api and /auth/login to the gateway on 8080)
npx nx serve shell-host
```

Defaults: identity `http://localhost:8081`, registry file
`platform/shell/config/remote-registry.json`, trusted origins `http://localhost:4301`.
Override with `SUPPORTFOLIO_SHELL_IDENTITY_URI`, `SUPPORTFOLIO_SHELL_REMOTE_REGISTRY_FILE`,
`SUPPORTFOLIO_SHELL_TRUSTED_REMOTE_ORIGINS`.

## Remote registry contract

`GET /api/remote-registry` → `{"projects":[{id, displayName, shortDescription, features[],
openUrl, exposedModules:[{name, version, remoteEntry}]}]}`. An unreadable registry answers
`503 {"error":"registry_unavailable"}` (no path or validation detail leaked).

**The registry file is data hot-read by the gateway on every request.** A project's CD
pipeline rewrites its own entry on deploy; the shell is never rebuilt or restarted when a
project is added or updated.

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
