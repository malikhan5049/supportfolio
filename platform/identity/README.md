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

All `supportfolio.identity.*` properties are absent from `application.yaml` by design
and required at runtime (the service's beans fail fast without them). See the comments
in `src/main/resources/application.yaml` for the property → environment-variable
mapping.
