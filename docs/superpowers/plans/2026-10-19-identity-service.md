# Identity Service Implementation Plan (Plan 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Identity service — the only component allowed to talk to the upstream identity provider (GitHub OAuth App today), which normalizes the provider response into one internal principal, resolves the user's role (admin/allowlisted user/denied), and issues its own signed JWT that every other service validates as a plain OAuth2 resource server.

**Architecture:** A new Spring Boot service at `platform/identity` (Gradle project `platform:identity`) using the existing `supportfolio.spring-service-conventions` plugin and depending on `platform:shared-spring-starter`. Login is GitHub OAuth2 authorization-code via Spring Security's `oauth2-client`; the provider-specific logic is isolated behind an `IdentityProvider` port with a `GitHubIdentityProvider` adapter (Keycloak adapter later via configuration swap, no changes elsewhere). Identity issues RS256 JWTs (Nimbus) from a static config-provided key, publishes the public key at `GET /oauth2/jwks`, and hands the token to the browser flow via a single-use short-lived code exchanged at `POST /api/token`. The resource-server half of the contract ships as a conditional auto-configuration added to `platform/shared-spring-starter`, so later services (shell, TinyURL) get JWT validation by opting in with one property.

**Tech Stack:** Spring Boot (BOM-managed per `gradle/libs.versions.toml`: Boot 4.1.1, Java 17), Spring Security `oauth2-client` + `oauth2-resource-server`, Nimbus JOSE+JWT (via `spring-security-oauth2-jose`), JUnit 5 + Spring `ApplicationContextRunner` / MockMvc, OkHttp `MockWebServer` (test-scope) for GitHub API simulation, `spring-security-test`.

**Spec:** [docs/superpowers/specs/2026-10-16-portfolio-platform-design.md](../specs/2026-10-16-portfolio-platform-design.md) — "Auth (abstracted, swappable)" and "Personas and access" sections.

## Scope decisions (my calls, flagged)

The spec leaves these open; they are decided here and the plan argues from them:

- **Plan 2 is backend-only.** The shared Angular auth library (login screen + redirect flow, `shared-ui-lib`) is Plan 3 (shell) scope, where it is first consumed. Plan 2 defines and proves the backend contract it will consume: login entry → one-time code → `POST /api/token` → JWT.
- **JWT delivery to the SPA is a one-time code, not a token in the URL.** After GitHub login, Identity redirects to the app's URL with `?code=<one-time-code>`; the app exchanges the code at `POST /api/token` for the JWT. Codes are in-memory, single-use, 60-second TTL.
- **Identity has no datastore.** Allowlist/admin/redirect-origins are configuration (env-overridable). Nothing persists across restarts except the signing key.
- **RS256 with a static config-provided PEM key**, generated once (`openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048`), supplied via env var, never committed. Resource servers only need the public key from the JWKS endpoint.
- **JWT claims:** `iss` (config: `supportfolio.identity.issuer`), `sub` = provider user id, `preferred_username` = login, `email`, `name`, `role` (`admin` | `user`), `exp` = issued + 3600s. Access token TTL 1 hour.
- **One role claim, not a roles array** — the spec has exactly two granted roles today (admin, user). Denial is absence of a code, not a role.
- **Single process, port 8081 (dev default);** actuator on the same port (YAGNI on a management port until Plan 5 infra).

## Global Constraints

- Identity is the **only** service that talks to the upstream identity provider (spec: Auth — this is the swap point; Keycloak later means changing only this service).
- Every other service is a plain OAuth2 **resource server** that only validates Identity's JWT — none of them know or care which provider sits behind it (spec: Auth).
- **Admin is hardcoded to the repo owner; users are an explicit allowlist**; role is resolved at login (spec: Personas; GOVERNANCE.md Policies). No anonymous access produces a JWT.
- Remotes never receive the shell's auth token; each backend validates its own JWT independently (spec: Security boundary) — Identity speaks to nothing except GitHub and the JWKS consumers.
- Backend style: package-by-feature, one public class per file, constructor injection only, Google Java Format via Spotless, `spotlessCheck` runs in `build` (CODING_STANDARDS.md; Task 18 of the foundations plan).
- Versions from `gradle/libs.versions.toml`: `java = 17`, `spring-boot = 4.1.1`. `mockwebserver` pinned `4.12.0` — verify it is still the latest 4.x stable against the okhttp release page at implementation time (**Constraint "verify before pin"**).
- GitHub OAuth App credentials come from env vars (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`); no secret is ever committed (GOVERNANCE.md Guardrails; secret scanning enforces).
- No PII (`email`, `login`, `name`) in log fields (GOVERNANCE.md Policies).
- Every commit follows Conventional Commits (`feat:`, `test:`, `ci:`, `docs:`, `chore:`).
- Auth-touching work: the PR for this plan must carry an OWASP checklist item (GOVERNANCE.md Policies) — price: the redirect-allowlist and single-use-code tests.

## Review Focus

The spec implies these failure modes but no happy-path test catches them. Each line pins the input and the expected behavior, with the test pinned to its owning task:

1. **The same one-time code must never mint a second token.** A replayed `POST /api/token` must fail with `400 {"error":"invalid_code"}`, never return a token — pinned to Task 7 (replay case in the `POST /api/token` MockMvc tests, exercising Task 5's single-use store).
2. **A redirect target on a non-allowlisted origin must be rejected before login even completes** — pinned to Task 6 (`RedirectOriginValidator` tests, including the `https://allowed.example.com.evil.com` lookalike).
3. **A GitHub user who is neither admin nor allowlisted must be denied with no code and no JWT** — pinned to Task 6 (`CustomOAuth2UserService` throws → no success handler → no code created).
4. **A third party holding only the JWKS public key must be able to verify an issued JWT** and modified/asserted claims must fail verification — pinned to Task 4 (issue → parse → verify roundtrip, including tampered-claims rejection).
5. **The starter's resource-server auto-configuration must stay inert** when `supportfolio.security.resource-server.enabled` is absent, so existing starter consumers don't silently gain security filters — pinned to Task 9 (inert-by-default `ApplicationContextRunner` test).

---

## Task 1: Identity module scaffold

**Files:**
- Modify: `settings.gradle.kts` (add `include("platform:identity")`)
- Create: `platform/identity/build.gradle.kts`
- Create: `platform/identity/src/main/java/com/supportfolio/platform/identity/IdentityApplication.java`
- Create: `platform/identity/src/main/resources/application.yaml`
- Create: `platform/identity/README.md`
- Create: `platform/identity/.gitignore` (ignores any local key material, never committed)

**Interfaces:**
- Produces: Gradle project `platform:identity` applying `supportfolio.spring-service-conventions`, with main class `com.supportfolio.platform.identity.IdentityApplication`. Service runs on port 8081 (`server.port`), all `supportfolio.identity.*` properties are absent-but-required-at-runtime (documented in README, enforced by later tasks' beans failing fast).

- [ ] **Step 1: Add the module**

`settings.gradle.kts`: add `include("platform:identity")` below the existing `include("platform:shared-spring-starter")`.

- [ ] **Step 2: Create `platform/identity/build.gradle.kts`**

```kotlin
plugins {
    id("supportfolio.spring-service-conventions")
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-security")
    implementation("org.springframework.boot:spring-boot-starter-oauth2-client")
    implementation("org.springframework.security:spring-security-oauth2-jose")

    testImplementation("org.springframework.security:spring-security-test")
    testImplementation("com.squareup.okhttp3:mockwebserver:4.12.0")
}
```

(Boot's BOM manages the Spring artifact versions; only the mockwebserver 4.12.0 pin is explicit — verify against https://github.com/square/okhttp/releases first.)

- [ ] **Step 3: Create `IdentityApplication.java`**

```java
@SpringBootApplication
public class IdentityApplication {
  public static void main(String[] args) {
    SpringApplication.run(IdentityApplication.class, args);
  }
}
```

- [ ] **Step 4: Create `application.yaml`** — `server.port: 8081`; no secrets. Property *names* to be used by later tasks are documented here as comments (env-var substitutions): `SUPPORTFOLIO_IDENTITY_ISSUER`, `SUPPORTFOLIO_IDENTITY_ADMIN_LOGIN`, `SUPPORTFOLIO_IDENTITY_ALLOWLIST`, `SUPPORTFOLIO_IDENTITY_REDIRECT_ORIGINS`, `SUPPORTFOLIO_IDENTITY_JWT_PRIVATE_KEY_PEM`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`.

- [ ] **Step 5: Create `platform/identity/README.md`** — one-time setup: (1) create a GitHub OAuth App (Settings → Developer settings) with callback URL `<identity-base-url>/login/oauth2/code/github`; (2) generate the RSA key with `openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048` and set it via `SUPPORTFOLIO_IDENTITY_JWT_PRIVATE_KEY_PEM`; (3) run locally with `./gradlew :platform:identity:bootRun`.

- [ ] **Step 6: Create `platform/identity/.gitignore`** — `*.pem`, `*.p12`, `*.key`.

- [ ] **Step 7: Verify the module builds**

Run: `./gradlew :platform:identity:build`
Expected: BUILD SUCCESSFUL (spotlessCheck included — format the new Java file).

- [ ] **Step 8: Commit**

```bash
git add settings.gradle.kts platform/identity
git commit -m "feat: add identity service module scaffold"
```

---

## Task 2: Principal model, IdentityProvider port, role resolution

**Files:**
- Create: `platform/identity/src/main/java/com/supportfolio/platform/identity/principal/IdentityRole.java`
- Create: `platform/identity/src/main/java/com/supportfolio/platform/identity/principal/ExternalIdentity.java`
- Create: `platform/identity/src/main/java/com/supportfolio/platform/identity/principal/InternalPrincipal.java`
- Create: `platform/identity/src/main/java/com/supportfolio/platform/identity/principal/IdentityProvider.java`
- Create: `platform/identity/src/main/java/com/supportfolio/platform/identity/principal/RoleResolver.java`
- Test: `platform/identity/src/test/java/com/supportfolio/platform/identity/principal/RoleResolverTest.java`
- Create: `platform/identity/src/main/java/com/supportfolio/platform/identity/IdentityProperties.java`

**Interfaces:**
- Produces (used by Tasks 3, 6, 7):
  - `enum IdentityRole { ADMIN, USER }`
  - `record ExternalIdentity(String providerUserId, String login, String email, String displayName)`
  - `record InternalPrincipal(String id, String login, String email, String displayName, IdentityRole role)` with `static InternalPrincipal of(ExternalIdentity e, IdentityRole role)` (id ← providerUserId).
  - `interface IdentityProvider { ExternalIdentity fetch(String accessToken); }` — the swap point; the Keycloak adapter later implements exactly this.
  - `RoleResolver(identityProperties)` with `Optional<IdentityRole> resolve(String login)` — ADMIN if `login` equals `identityProperties.adminLogin()` (case-insensitive), USER if present in `allowlist()`, empty otherwise. Admin wins over allowlist.
  - `@ConfigurationProperties("supportfolio.identity") record IdentityProperties(String issuer, String adminLogin, List<String> allowlist, List<String> redirectOrigins, String jwtPrivateKeyPem, String githubApiBaseUrl, long codeTtlSeconds, long accessTokenTtlSeconds)` — defaults: `codeTtlSeconds=60`, `accessTokenTtlSeconds=3600`, `githubApiBaseUrl="https://api.github.com"`.

- [ ] **Step 1: Write the failing tests**

```java
class RoleResolverTest {
  private final IdentityProperties props = new IdentityProperties(
      "http://localhost:8081", "owner-login", List.of("friend-login"),
      List.of("http://localhost:4200"), null, "https://api.github.com", 60, 3600);
  private final RoleResolver resolver = new RoleResolver(props);

  @Test
  void repoOwnerGetsAdminRole() {
    assertEquals(Optional.of(IdentityRole.ADMIN), resolver.resolve("owner-login"));
  }

  @Test
  void allowlistedUserGetsUserRole() {
    assertEquals(Optional.of(IdentityRole.USER), resolver.resolve("friend-login"));
  }

  @Test
  void unknownLoginGetsNoRole() {
    assertEquals(Optional.empty(), resolver.resolve("stranger"));
  }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./gradlew :platform:identity:test`
Expected: FAIL — `RoleResolver` does not exist.

- [ ] **Step 3: Implement** `IdentityRole`, `ExternalIdentity`, `InternalPrincipal`, `IdentityProvider`, `RoleResolver`, `IdentityProperties` exactly as declared in the Interfaces block (verify constructor arity matches the test's arguments).

- [ ] **Step 4: Run test to verify it passes**

Run: `./gradlew :platform:identity:test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add platform/identity/src
git commit -m "feat: add identity principal model and role resolution"
```

---

## Task 3: GitHubIdentityProvider adapter

**Files:**
- Create: `platform/identity/src/main/java/com/supportfolio/platform/identity/provider/GitHubIdentityProvider.java`
- Test: `platform/identity/src/test/java/com/supportfolio/platform/identity/provider/GitHubIdentityProviderTest.java`

**Interfaces:**
- Consumes: `IdentityProvider.fetch(String accessToken)`, `ExternalIdentity` (Task 2); `identityProperties.githubApiBaseUrl()` (Task 2).
- Produces: `GitHubIdentityProvider implements IdentityProvider` — issues `GET {githubApiBaseUrl}/user` and `GET {githubApiBaseUrl}/user/emails` (header `Authorization: Bearer <accessToken>`, `Accept: application/vnd.github+json`) and maps to `ExternalIdentity(providerUserId=String(json.id), login=json.login, email=primary non-legacy verified email or null, displayName=json.name or login)`.

- [ ] **Step 1: Write the failing tests** (MockWebServer as the GitHub API; base URL pointed at the mock):

```java
class GitHubIdentityProviderTest {
  // MockWebServer enqueued responses: /user -> {"id":123,"login":"octocat","name":"The Octocat"}
  //                               /user/emails -> [{"email":"a@x.com","primary":true,"verified":true,"visibility":"private"}]

  @Test
  void normalizesGitHubUserIntoExternalIdentity() {
    ExternalIdentity id = provider.fetch("gh-token");
    assertEquals(new ExternalIdentity("123", "octocat", "a@x.com", "The Octocat"), id);
  }

  @Test
  void picksTheFirstVerifiedPrimaryEmail() { /* second /user/emails response has primary=false first, then primary=true */ }

  @Test
  void fallsBackToNullEmailWhenNoVerifiedPrimaryEmailExists() { /* /user/emails -> [{"email":"b@x.com","primary":false,"verified":false}] -> email null */ }

  @Test
  void displaysNameFallbackToLoginWhenNameIsNull() { /* /user -> {"id":9,"login":"octocat","name":null} -> displayName "octocat" */ }

  @Test
  void propagatesUnauthorizedAsIllegalStateException() { /* enqueued 401 -> assertThrows(IllegalStateException) */ }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./gradlew :platform:identity:test --tests "*GitHubIdentityProviderTest*"`
Expected: FAIL — class does not exist.

- [ ] **Step 3: Implement `GitHubIdentityProvider(RestClient.Builder, IdentityProperties)`**

Build a `RestClient` rooted at `githubApiBaseUrl`; two GET calls; parse both bodies as `JsonNode`; five test-mapped behaviors above. Wrap unexpected statuses in `IllegalStateException` (never leak the access token in a message).

- [ ] **Step 4: Run test to verify it passes**

Run: `./gradlew :platform:identity:test --tests "*GitHubIdentityProviderTest*"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add platform/identity/src
git commit -m "feat: add GitHub identity provider adapter"
```

---

## Task 4: JwtIssuer + JWKS endpoint

**Files:**
- Create: `platform/identity/src/main/java/com/supportfolio/platform/identity/token/JwtIssuer.java`
- Create: `platform/identity/src/main/java/com/supportfolio/platform/identity/token/JwksController.java`
- Test: `platform/identity/src/test/java/com/supportfolio/platform/identity/token/JwtIssuerTest.java`
- Test: `platform/identity/src/test/java/com/supportfolio/platform/identity/token/JwksControllerTest.java`

**Interfaces:**
- Consumes: `InternalPrincipal` (Task 2); `IdentityProperties.issuer()`, `.jwtPrivateKeyPem()`, `.accessTokenTtlSeconds()` (Task 2).
- Produces (used by Tasks 6, 8 and by every later resource server):
  - `JwtIssuer(IdentityProperties)` with `String issue(InternalPrincipal principal)` — RS256 signed JWT with exactly these claims: `iss`=`supportfolio.identity.issuer`, `sub`=`principal.id()`, `preferred_username`=`principal.login()`, `email`=`principal.email()`, `name`=`principal.displayName()`, `role`=`principal.role().name().toLowerCase()` (`"admin"`|`"user"`), `exp`=now+`accessTokenTtlSeconds`, `iat`=now.
  - `JwksController` — `@GetMapping("/oauth2/jwks")` returning the public `JWKSet` as a `Map<String,Object>` (`new JWKSet(rsaKey).toJSONObject(true)`); builds `RSAKey` (public + matching `KeyID`) from the parsed private key PEM. One `KeyID` per key, stable for the lifetime of the process.

- [ ] **Step 1: Write the failing tests** — generate an RSA keypair in the test (`KeyPairGenerator.getInstance("RSA")`, 2048), encode the private key to PKCS#8 PEM, build `IdentityProperties` with it:

```java
class JwtIssuerTest {
  // token = jwtIssuer.issue(new InternalPrincipal("123", "octocat", "a@x.com", "The Octocat", IdentityRole.USER));

  @Test
  void issuedTokenVerifiesAgainstItsOwnPublicKey() {
    SignedJWT parsed = SignedJWT.parse(token);
    assertTrue(parsed.verify(new RSAVerifier(publicKey))); // publicKey reconstructed from the test keypair
  }

  @Test
  void issuedTokenCarriesExactlyTheContractedClaims() {
    // parse claims: iss, sub="123", preferred_username="octocat", email, name, role="user"; exp-iat ≈ 3600
  }

  @Test
  void tamperedSignatureFailsVerification() {
    // flip one byte of the signature; RSAVerifier.verify(...) is false
  }
}
```

The `JwksControllerTest` (MockMvc): `GET /oauth2/jwks` → 200, body parses via `JWKSet.parse(json)`, and the returned `RSAKey` successfully verifies a token issued by `JwtIssuer` (the two classes must agree on `KeyID` and key material).

- [ ] **Step 2: Run tests to verify they fail**

Run: `./gradlew :platform:identity:test`
Expected: FAIL — `JwtIssuer` does not exist.

- [ ] **Step 3: Implement `JwtIssuer` and `JwksController`**

Nimbus: parse the PEM (`Base64` body of the `-----BEGIN PRIVATE KEY-----` block → `PKCS8EncodedKeySpec` → `KeyFactory.getInstance("RSA")`), one shared `RSAKey` (`keyID` = Base64url of SHA-256 of the public modulus — stable across restarts with the same key), `SignedJWT` + header `RS256`, then `serialize()`. Fail fast at bean construction when `jwtPrivateKeyPem` is absent or unparseable.

- [ ] **Step 4: Run tests to verify they pass**

Run: `./gradlew :platform:identity:test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add platform/identity/src
git commit -m "feat: add JWT issuance and JWKS publication for identity"
```

---

## Task 5: One-time login code store

**Files:**
- Create: `platform/identity/src/main/java/com/supportfolio/platform/identity/token/OneTimeCodeStore.java`
- Test: `platform/identity/src/test/java/com/supportfolio/platform/identity/token/OneTimeCodeStoreTest.java`

**Interfaces:**
- Consumes: `InternalPrincipal` (Task 2); `IdentityProperties.codeTtlSeconds()` (Task 2, default 60).
- Produces (used by Tasks 6, 7): `OneTimeCodeStore(IdentityProperties)` with
  - `String create(InternalPrincipal principal)` — returns a URL-safe random code (≥ 32 chars, `SecureRandom`), remembering the principal with a 60-second expiry;
  - `Optional<InternalPrincipal> consume(String code)` — single-use: first consume removes and returns the principal; any later consume of the same code returns empty. Expired codes return empty.

- [ ] **Step 1: Write the failing tests**

```java
class OneTimeCodeStoreTest {
  @Test
  void consumeReturnsPrincipalExactlyOnce() {
    String code = store.create(knownPrincipal);
    assertEquals(Optional.of(knownPrincipal), store.consume(code));
    assertEquals(Optional.empty(), store.consume(code)); // replay rejected
  }

  @Test
  void unknownCodeIsEmpty() {
    assertEquals(Optional.empty(), store.consume("nope"));
  }

  @Test
  void codeIsSingleUseBeforeExpiry() { /* two codes minted for two principals do not collide; each maps to its own principal */ }

  @Test
  void expiredCodeIsEmpty() { /* drive store built with codeTtlSeconds=0 → immediately expired → consume empty */ }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./gradlew :platform:identity:test --tests "*OneTimeCodeStoreTest*"`
Expected: FAIL — class does not exist.

- [ ] **Step 3: Implement `OneTimeCodeStore`**

`ConcurrentHashMap<String, ExpiringEntry>` with lazy expiry check inside `consume` (no background sweeper). Codes are 32+ chars of `SecureRandom`-generated URL-safe base64.

- [ ] **Step 4: Run test to verify it passes**

Run: `./gradlew :platform:identity:test --tests "*OneTimeCodeStoreTest*"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add platform/identity/src
git commit -m "feat: add single-use short-lived login code store"
```

---

## Task 6: Login flow — SecurityFilterChain, redirect gate, user service, success handler

**Files:**
- Create: `platform/identity/src/main/java/com/supportfolio/platform/identity/login/SecurityConfig.java`
- Create: `platform/identity/src/main/java/com/supportfolio/platform/identity/login/LoginRedirectController.java`
- Create: `platform/identity/src/main/java/com/supportfolio/platform/identity/login/RedirectOriginValidator.java`
- Create: `platform/identity/src/main/java/com/supportfolio/platform/identity/login/CustomOAuth2UserService.java`
- Create: `platform/identity/src/main/java/com/supportfolio/platform/identity/login/LoginSuccessHandler.java`
- Create: `platform/identity/src/main/resources/application.yaml` (modify — GitHub client registration reading env vars)
- Test: `platform/identity/src/test/java/com/supportfolio/platform/identity/login/RedirectOriginValidatorTest.java`
- Test: `platform/identity/src/test/java/com/supportfolio/platform/identity/login/CustomOAuth2UserServiceTest.java`
- Test: `platform/identity/src/test/java/com/supportfolio/platform/identity/login/LoginSuccessHandlerTest.java`
- Test: `platform/identity/src/test/java/com/supportfolio/platform/identity/login/SecurityConfigTest.java`

**Interfaces:**
- Consumes: `IdentityProvider` + `RoleResolver` + `InternalPrincipal` (Tasks 2, 3); `OneTimeCodeStore` (Task 5); `IdentityProperties.redirectOrigins()` (Task 2).
- Produces:
  - `SecurityConfig` — `@Bean SecurityFilterChain`: permits `/oauth2/jwks`, `/api/token`, `/login/**`, and `/auth/login`; activates `oauth2Login()` (github registration from `spring.security.oauth2.client.registration.github.*`) with `userInfoService(customOAuth2UserService)` and `successHandler(loginSuccessHandler)`; failure redirects to `/login?error`.
  - `CustomOAuth2UserService extends DefaultOAuth2UserService` — loads the GitHub access token from `OAuth2UserRequest`, calls `IdentityProvider.fetch(token)`, `RoleResolver.resolve(login)`; role empty → throw `new OAuth2AuthenticationException(new OAuth2Error("access_denied"), "no role")` → denied user never produces a code (Review Focus #3). On success it returns an `OAuth2User` whose attributes carry `sub`, `preferred_username`, `email`, `name`, `role` (the JWT claim names, so the success handler maps 1:1 to the JWT).
  - `LoginRedirectController` — `@GetMapping("/auth/login")` with `@RequestParam String redirect`: origin must pass `RedirectOriginValidator(HttpSession)` → store the full target URL in session attr `post-login-redirect` → 302 to `/oauth2/authorization/github`; invalid origin → `400` (Review Focus #2, rejected *before* the GitHub dance starts).
  - `RedirectOriginValidator` — `boolean isValid(String url, List<String> allowedOrigins)`: parses the URI, scheme+host+port (lowercased) must exactly equal (string-compare against the lowercased allowlist) one entry's scheme+host+port. Any parse failure → false.
  - `LoginSuccessHandler implements AuthenticationSuccessHandler` — reads the authenticated `OAuth2User`'s attributes into `InternalPrincipal`, creates a code via `OneTimeCodeStore`, 302-redirects to the session-stored target URL with `?code=` (or `&code=` if the target already has a query). No identity PII is logged at any point (Global Constraints).

- [ ] **Step 1: Write the failing tests**

`RedirectOriginValidatorTest`:

```java
@Test
void allowsExactOriginMatch() {
  assertTrue(validator.isValid("https://shell.example.com/some/path",
      List.of("https://shell.example.com")));
}
@Test
void rejectsLookalikeOrigin() {
  assertFalse(validator.isValid("https://shell.example.com.evil.com/hook",
      List.of("https://shell.example.com")));
}
@Test
void rejectsDifferentPortAndScheme() {
  assertFalse(validator.isValid("http://shell.example.com", List.of("https://shell.example.com")));
}
@Test
void rejectsUnparsableUrl() {
  assertFalse(validator.isValid("::::not-a-url", List.of("https://shell.example.com")));
}
```

`CustomOAuth2UserServiceTest`: with mocked `IdentityProvider` and `RoleResolver` — allowed login → returned `OAuth2User` attributes contain the five contract claim names; denied login → assertThrows(`OAuth2AuthenticationException`).

`LoginSuccessHandlerTest`: with a real `OneTimeCodeStore` — happy path: the response's redirect URL starts with the session-stored target and contains `code=<a value returned by store.create>`; then `store.consume(...)` retrieves the principal. No session target → response status 400, no code created.

`SecurityConfigTest` (MockMvc, minimal `@SpringBootTest` slice with test properties for a throwaway RSA PEM key, github registration, issuer, allowlist, one redirect origin): `GET /api/nothing-that-exists` unauthenticated → status is not 500 and not a straight 403-without-redirect (the filter chain resolves; assert `3xx` redirect to the GitHub authorization entry point or `401`; the exact Spring behavior is whatever oauth2Login's default entry point produces — pin only "request did not reach an unprotected controller").

- [ ] **Step 2: Run tests to verify they fail**

Run: `./gradlew :platform:identity:test`
Expected: FAIL — classes do not exist.

- [ ] **Step 3: Implement** the five classes exactly as declared above; `application.yaml` gains:

```yaml
spring:
  security:
    oauth2:
      client:
        registration:
          github:
            client-id: ${GITHUB_CLIENT_ID}
            client-secret: ${GITHUB_CLIENT_SECRET}
            scope: read:user,user:email
        provider:
          github:
            user-info-uri: ${SUPPORTFOLIO_IDENTITY_GITHUB_API_BASE_URL:https://github.com}/user # base overridden in tests
```

(Task 8 overrides the token/authorize/user-info endpoints of this provider block to point at MockWebServer — keep the structure above so that override is a property change, not code.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `./gradlew :platform:identity:test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add platform/identity
git commit -m "feat: add GitHub OAuth2 login flow with redirect allowlist"
```

---

## Task 7: Token endpoint `POST /api/token`

**Files:**
- Create: `platform/identity/src/main/java/com/supportfolio/platform/identity/token/TokenController.java`
- Modify: `platform/identity/src/main/java/com/supportfolio/platform/identity/login/SecurityConfig.java` (no change expected — `/api/token` was already permitted; verify only)
- Test: `platform/identity/src/test/java/com/supportfolio/platform/identity/token/TokenControllerTest.java`

**Interfaces:**
- Consumes: `OneTimeCodeStore.consume(String)` (Task 5), `JwtIssuer.issue(InternalPrincipal)` (Task 4).
- Produces: `TokenController` — `@PostMapping("/api/token")` accepting body `record TokenRequest(String code)`, returning
  - `200` `record TokenResponse(String accessToken, String tokenType, long expiresIn, PrincipalView principal)` with `tokenType="Bearer"`, `expiresIn=accessTokenTtlSeconds`, `record PrincipalView(String id, String login, String email, String displayName, String role)` — for a valid unexpired single-use code;
  - `400` `{"error":"invalid_code"}` for unknown, used, or expired codes (uniform error — never distinguish which, so replay probing learns nothing).

- [ ] **Step 1: Write the failing tests** (MockMvc; real `OneTimeCodeStore` + `JwtIssuer` beans from test properties):

```java
@Test
void validCodeReturnsTokenContract() { /* create a code first; expect accessToken + tokenType "Bearer" + expiresIn 3600 + principal.id/login/role */ }

@Test
void usedCodeIsRejectedOnReplay() { /* exchange once (200); exchange the same code again → 400 {"error":"invalid_code"} */ }

@Test
void expiredCodeIsRejected() { /* store built with codeTtlSeconds=0 → 400 */ }

@Test
void unknownCodeIsRejected() { /* random code → 400; same uniform error body */ }

@Test
void principalNeverLogsWithPii() { /* no assertion beyond one: response body contains no issue-time logline capture — covered by spotless/logging review; skipped if no log capture exists */ }
```

(Drop the last test if no log-capture harness exists in the module — the no-PII constraint is enforced by review on this task.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `./gradlew :platform:identity:test --tests "*TokenControllerTest*"`
Expected: FAIL — `TokenController` does not exist.

- [ ] **Step 3: Implement `TokenController`** — one path: `consume` → present? issue and return contract : return 400 uniform error.

- [ ] **Step 4: Run tests to verify they pass**

Run: `./gradlew :platform:identity:test --tests "*TokenControllerTest*"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add platform/identity
git commit -m "feat: add one-time code to JWT token exchange endpoint"
```

---

## Task 8: End-to-end login → code → token flow

**Files:**
- Modify: `platform/identity/src/test/resources/application-test.yaml` or `@SpringBootTest` properties (test-only override of GitHub provider endpoints to MockWebServer)
- Test: `platform/identity/src/test/java/com/supportfolio/platform/identity/IdentityFlowIntegrationTest.java`

**Interfaces:**
- Consumes: everything from Tasks 1–7 wired as a real application context (`webEnvironment = RANDOM_PORT`).

- [ ] **Step 1: Write the failing integration test**

`@SpringBootTest(webEnvironment = RANDOM_PORT)` + a static `MockWebServer` standing in for GitHub; properties point `spring.security.oauth2.client.provider.github` token/authorize/user-info endpoints and `SUPPORTFOLIO_IDENTITY_GITHUB_API_BASE_URL` at the mock server; MockWebServer enqueues: `GET /user` + `GET /user/emails` (allowlisted user), and the OAuth2 authorize-page step returns a redirect with a fake `code` for the token exchange, which returns `{"access_token":"gh-token"}`.

The test walks the whole flow and asserts, in order:

1. `GET /auth/login?redirect=<allowed-origin>/app` (allowed origin) → 302 to the mock authorize endpoint.
2. Follow the authorize step to `<identity>/login/oauth2/code/github?code=gh-code&state=...` → final 302 to `<allowed-origin>/app?code=<one-time-code>`.
3. `GET <allowed-origin>/app?code=<code>` is NOT made by the test — instead `POST /api/token {"code":"<one-time-code>"}` → 200 with `accessToken`.
4. Parse and verify the JWT against `GET /oauth2/jwks` (fetched from the running server) — `role=="user"`, signature valid, `iss` correct.

- [ ] **Step 2: Run to verify it fails**

Run: `./gradlew :platform:identity:test --tests "*IdentityFlowIntegrationTest*"`
Expected: FAIL (flow misconfigured — the wiring between Tasks 6 and 7 is what this test exists to catch).

- [ ] **Step 3: Fix wiring until green (property/config changes only — no new production classes)**

- [ ] **Step 4: Full module test run**

Run: `./gradlew :platform:identity:test`
Expected: PASS (all tasks' tests together).

- [ ] **Step 5: Commit**

```bash
git add platform/identity/src/test
git commit -m "test: add end-to-end identity login and token exchange flow"
```

---

## Task 9: Resource-server autoconfiguration in shared-spring-starter

**Files:**
- Modify: `platform/shared-spring-starter/build.gradle.kts`
- Create: `platform/shared-spring-starter/src/main/java/com/supportfolio/platform/sharedstarter/security/SharedSecurityProperties.java`
- Create: `platform/shared-spring-starter/src/main/java/com/supportfolio/platform/sharedstarter/security/IdentityResourceServerAutoConfiguration.java`
- Modify: `platform/shared-spring-starter/src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` (add the new class)
- Test: `platform/shared-spring-starter/src/test/java/com/supportfolio/platform/sharedstarter/security/IdentityResourceServerAutoConfigurationTest.java`

**Interfaces:**
- Consumes: nothing from the identity module (the starter never depends on it — the JWT contract is just claims + JWKS).
- Produces (consumed by shell Plan 3 and TinyURL Plan 4):
  - `@ConfigurationProperties("supportfolio.security") record SharedSecurityProperties(String jwkSetUri, String issuerUri)` — registered via `@EnableConfigurationProperties` on the autoconfiguration.
  - `@AutoConfiguration @ConditionalOnClass(NimbusJwtDecoder.class) @ConditionalOnProperty(name="supportfolio.security.resource-server.enabled", havingValue="true")` → `@Bean SecurityFilterChain securityFilterChain(HttpSecurity http, SharedSecurityProperties props)`: `authorizeHttpRequests(anyRequest().authenticated())`, `oauth2ResourceServer().jwt()` with `NimbusJwtDecoder.withJwkSetUri(props.jwkSetUri()).build()` + `JwtValidators.createDefaultWithIssuer(props.issuerUri())`, and a `JwtAuthenticationConverter` mapping claim `role` → authority `ROLE_<UPPERCASE ROLE>`.

- [ ] **Step 1: Extend `platform/shared-spring-starter/build.gradle.kts`**

```kotlin
dependencies {
    compileOnly("org.springframework.boot:spring-boot-starter-oauth2-resource-server")
    testImplementation("org.springframework.boot:spring-boot-starter-oauth2-resource-server")
    testImplementation("org.springframework.boot:spring-boot-starter-web")
}
```

`compileOnly` is deliberate: a starter consumer does not get Spring Security pulled in until it opts in by adding `spring-boot-starter-oauth2-resource-server` itself, so the starter can never silently change another service's security posture.

- [ ] **Step 2: Write the failing tests** (`ApplicationContextRunner`, same pattern as `SharedStarterAutoConfigurationTest`; use `FilteredClassLoader` to simulate compileOnly absence):

```java
class IdentityResourceServerAutoConfigurationTest {
  private final ApplicationContextRunner runner = new ApplicationContextRunner()
      .withConfiguration(AutoConfigurations.of(IdentityResourceServerAutoConfiguration.class));

  @Test
  void inertWhenFlagIsAbsent() {
    runner.run(context -> assertThat(context).doesNotHaveBean(SecurityFilterChain.class)); // Review Focus #5
  }

  @Test
  void inertWhenSecurityRuntimeAbsent() {
    runner.withClassLoader(new FilteredClassLoader(NimbusJwtDecoder.class, SecurityFilterChain.class))
        .withPropertyValues("supportfolio.security.resource-server.enabled=true")
        .run(context -> assertThat(context).doesNotHaveBean(SecurityFilterChain.class));
  }

  @Test
  void securesEverythingWhenEnabled() {
    runner.withPropertyValues(
        "supportfolio.security.resource-server.enabled=true",
        "supportfolio.security.jwk-set-uri=http://localhost:8081/oauth2/jwks",
        "supportfolio.security.issuer-uri=http://localhost:8081")
        .run(context -> assertThat(context).hasSingleBean(SecurityFilterChain.class));
  }
}
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `./gradlew :platform:shared-spring-starter:test`
Expected: FAIL — autoconfiguration does not exist.

- [ ] **Step 4: Implement** the autoconfiguration and properties record; add the class name to `AutoConfiguration.imports`.

- [ ] **Step 5: Run tests to verify they pass, and the whole repo build stays green**

Run: `./gradlew :platform:shared-spring-starter:test :platform:identity:test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add platform/shared-spring-starter
git commit -m "feat: add opt-in identity resource-server autoconfiguration to shared starter"
```

---

## Task 10: Platform CI workflow + branch protection

**Files:**
- Create: `.github/workflows/platform-ci.yml`
- Modify: `tools/validate-workflows.spec.ts` (add the matching YAML-validity case — same pattern as the Tasks 8/9/13/19 cases of the foundations plan)
- Modify: `.github/workflows/apply-branch-protection.yml` (line 30: add the new required check to the list)
- Modify: `platform/harness/ACTIVATION.md` (append a note: ruleset refresh is manual — re-dispatching would duplicate the ruleset)

**Interfaces:**
- Produces: every push/PR runs the full Java build (`:platform:identity`, `:platform:shared-spring-starter` tests + Spotless + `build-logic` tests), and the new required status check joins the merge gate.

- [ ] **Step 1: Write the failing test** in `tools/validate-workflows.spec.ts`:

```typescript
it('platform-ci.yml is valid YAML that builds platform modules', () => {
  const doc = yaml.load(fs.readFileSync('.github/workflows/platform-ci.yml', 'utf8'));
  expect(doc.jobs['platform-build']).toBeDefined();
  expect(doc.jobs['platform-build'].steps.map(s => s.run)).toEqual(
    expect.arrayContaining([expect.stringContaining('./gradlew build')]),
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tools/validate-workflows.spec.ts`
Expected: FAIL — file does not exist.

- [ ] **Step 3: Write `.github/workflows/platform-ci.yml`**

`name: Platform CI`; triggers `push` + `pull_request`; one job `platform-build` on `ubuntu-latest`: checkout → `actions/setup-java@v4` (`distribution: temurin`, `java-version: 17` — matches `gradle/libs.versions.toml`) → `./gradlew build` → `./gradlew -p build-logic test`.

- [ ] **Step 4: Update the required-checks list in `apply-branch-protection.yml`** — add `'Platform CI / platform-build'` to the array on line 30 (GitHub reports the check-run name as `Workflow name / job id`). Append to `platform/harness/ACTIVATION.md`: after this workflow lands, the ruleset must be refreshed **manually** via GitHub Settings → Rules → Rulesets (re-dispatching `apply-branch-protection.yml` would duplicate the ruleset — POST is not idempotent), then verify the check name matches what GitHub reports (ACTIVATION.md step 5 rule).

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest tools/validate-workflows.spec.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add .github/workflows tools/validate-workflows.spec.ts platform/harness/ACTIVATION.md
git commit -m "ci: add platform CI build workflow and register required status check"
```

---

## Self-Review Notes

- **Spec coverage:** every requirement of the spec's "Auth (abstracted, swappable)" and "Personas and access" sections is implemented: dedicated Identity service as sole provider-toucher (Tasks 1–8, `IdentityProvider` port at Task 2 = the swap point), own signed JWT with one internal principal shape (Tasks 2, 4), every other service as plain resource server validating only this JWT (Task 9), role resolved at login with hardcoded admin + explicit allowlist (Tasks 2, 6), shared login flow reachable per-app later via `{app}/auth/login?redirect=` (Task 6 — the Angular library consuming it is Plan 3, flagged in Scope decisions). Deliberately out of scope: Angular auth UI library (Plan 3), Keycloak adapter (later, via the Task 2 port), token transport hardening beyond the one-time code (revisit if a real user base appears), build-logic composite-cache CI (pre-existing gap, noted but not this plan's fix).
- **Step scan:** every step produces one unambiguous artifact (a named test with its assertions, a class with its exact signature, a command with its expected output, or a commit); no "TBD" or unspecified-body steps; the only bodies given are algorithms the signatures don't determine (PEM parsing, JWK KeyID derivation, error-uniformity rule).
- **Type consistency:** claim names (`sub`, `preferred_username`, `email`, `name`, `role`) are identical in `JwtIssuer` (Task 4), `CustomOAuth2UserService` attributes (Task 6), `TokenController.PrincipalView` (Task 7), and the starter's role converter (Task 9); `InternalPrincipal`/`IdentityRole` are defined once (Task 2) and consumed unchanged by Tasks 3–7; the starter (Task 9) depends on nothing from the identity module.
- **Review Focus:** all five pinned — replay (Task 7 via Task 5), origin lookalike (Task 6), denied unknown user (Task 6), public-key-only verification + tamper rejection (Task 4), inert starter autoconfig (Task 9).
- **Proportion:** the plan is scoped to the backend contract the spec's Auth section defines; Plan 1 (foundations, 20 tasks / full harness) set the granularity, and this plan matches it without transcribing the service — roughly one test cycle per task, code steps carry signatures and pinned values, not implementations.
