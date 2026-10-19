# Identity Service

Spring Boot service that authenticates users via GitHub OAuth and issues JWTs.
Runs on port 8081.

## One-time setup

1. **Create a GitHub OAuth App** — GitHub → Settings → Developer settings → OAuth Apps →
   New OAuth App. Set the callback/authorization URL to
   `<identity-base-url>/login/oauth2/code/github` (for local development:
   `http://localhost:8081/login/oauth2/code/github`). Note the resulting client ID and
   client secret; export them as `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.

2. **Generate the JWT signing key** — create an RSA private key and provide it as the
   `SUPPORTFOLIO_IDENTITY_JWT_PRIVATE_KEY_PEM` environment variable:

   ```bash
   openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048
   ```

   Key material (`*.pem`, `*.p12`, `*.key`) is git-ignored and must never be committed.

3. **Run locally**:

   ```bash
   ./gradlew :platform:identity:bootRun
   ```

## Required runtime properties

All `supportfolio.identity.*` properties are absent from `application.yaml` by design.
`SUPPORTFOLIO_IDENTITY_ALLOWLIST` may be empty (no allowlisted users), but the
following environment variables are boot-required — the service's beans fail fast
at startup if any of them is missing, blank, or (for the PEM) unusable. See the
comments in `src/main/resources/application.yaml` for the property →
environment-variable mapping, and the GitHub OAuth App credentials above for the
client id/secret, which Spring Security's OAuth2 client configuration also
requires at boot.

- `SUPPORTFOLIO_IDENTITY_ISSUER`
- `SUPPORTFOLIO_IDENTITY_ADMIN_LOGIN`
- `SUPPORTFOLIO_IDENTITY_REDIRECT_ORIGINS`
- `SUPPORTFOLIO_IDENTITY_JWT_PRIVATE_KEY_PEM`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`

## Cross-origin contract (Plan 3)

Identity serves **no CORS configuration** in Plan 2. A browser SPA on a different
origin therefore cannot call `POST /api/token` cross-origin until either:

- **(a)** Plan 3 adds CORS to the identity service, scoped to the allowlisted
  `redirectOrigins` for `/api/token` (and `/auth/login` if it is called from the
  browser), or
- **(b)** the shell/gateway serves the SPA same-origin behind a reverse proxy.

That decision is Plan 3's to make. Two related constraints:

- **Redirect targets must not contain a URL fragment (`#...`).** A fragment makes
  the identity redirect land as `...#fragment?code=...` — the `?code=` parameter
  ends up *after* the fragment, which the SPA cannot read from the query. Plan 3's
  auth library must construct fragment-free redirect URLs.
