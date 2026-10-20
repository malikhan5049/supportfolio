# Shell / Gateway Implementation Plan (Plan 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shell — a Spring Cloud Gateway in front of the Identity service plus an Angular host that renders a card grid and loads each project's `card` microfrontend from a runtime remote registry, with the shared Angular auth library (fragment-free login + code exchange), CSP allowlisting for remotes, and a fixture "Identity" remote that proves dynamic loading end to end.

**Architecture:** A new Gradle module `platform:shell` is a **Spring Cloud Gateway Server MVC** (servlet, same runtime as Identity) that serves the SPA, proxies the login/token endpoints to Identity same-origin, exposes a hot-reloaded JSON remote registry at `/api/remote-registry`, applies CSP derived from a configured trusted-origin allowlist, and (as a plain resource server via `platform:shared-spring-starter`) protects one read-only identity endpoint. The Angular host at `platform/shell/host` consumes the shared `CardComponent`/`RemoteRegistryService` from `platform/shared-ui-lib`, shares Angular/RxJS as singletons through Module Federation, and dynamically resolves `card` modules from registry entries — never from build-time `remotes`. A disposable Nx app at `platform/shell/testing/identity-card` exposes `./card` and stands in for the first real project (TinyURL is Plan 4). The shared auth library lives in `platform/shared-ui-lib/src/lib/auth`.

**Tech Stack:** Spring Boot 4.1.1 (Java 17), Spring Cloud Gateway Server MVC 5.0.3 via the `spring-cloud-dependencies` BOM, Spring Security resource server through `platform:shared-spring-starter`, JUnit 5 + MockMvc + MockWebServer; Angular 22.1.x, Nx 23.3.0, Jest + `@testing-library/angular`, `@angular-architects/module-federation@22.0.0` (webpack Module Federation), Playwright 1.64.1 for one browser E2E.

**Spec:** [docs/superpowers/specs/2026-10-16-portfolio-platform-design.md](../specs/2026-10-16-portfolio-platform-design.md) — "Shell / Gateway", "Microfrontend sharing foundation", "Personas and access", "Auth (abstracted, swappable)", "Environments and infrastructure".

## Scope decisions (my calls, flagged)

The spec leaves these open, or Plan 2 handed them over; they are decided here and the plan argues from them:

- **CORS is not added to Identity — the shell is same-origin (Plan 2 handoff (a), option b).** In production the gateway serves the SPA and proxies `/api/token`, `/auth/login`, `/oauth2/**`, and `/login/**` to Identity, so the token `POST` is same-origin. In dev the SPA login *navigation* goes directly to `http://localhost:8081` (a top-level navigation, not a CORS request) while the callback target is `http://localhost:4200/auth/callback` and the token `POST` goes through the Angular dev-server proxy to the gateway. No `Access-Control-Allow-*` header is added anywhere.
- **Spring Cloud Gateway Server MVC (servlet), not WebFlux.** It lets the shell reuse Plan 2's servlet `SecurityFilterChain` autoconfiguration, serve static SPA files, and run servlet filters for CSP on one stack; "thin aggregator" does not need reactive throughput.
- **The card grid is public; project access is each project's own concern.** Anonymous visitors can browse cards (recruiter-facing showcase). The shell is still a resource server as the spec requires, with exactly one protected endpoint `GET /api/session/me` returning the JWT claims — no project business logic, no datastore.
- **Token storage is `sessionStorage`, tab-scoped, and the shell never passes it to a remote.** Remotes are first-party code pinned by CSP; the spec accepts the shell-origin trust model and defers iframe isolation. The residual risk (same-origin remote code could read web storage) is recorded in Self-Review Notes, not hidden.
- **The registry is a JSON file read by the gateway on every request, updated by CD, never compiled into the SPA.** One project's deploy rewrites its entry; the shell is not rebuilt or restarted. Trusted origins are a *separate* configuration allowlist, not derived from the registry (a compromised registry file cannot widen CSP).
- **Module Federation is webpack-based via `@angular-architects/module-federation@22.0.0`.** Angular 22's default esbuild builder has no first-party MF support and Nx 23 deprecates its Angular MF wrappers; this package is the Angular-22-supported webpack path. The host has an empty build-time `remotes` map and calls `loadRemoteModule({ remoteEntry, remoteName, exposedModule })` with the registry's values.
- **Identity gains a login-failure handler (Plan 2 handoff (c), browser half).** Without it a denied GitHub user lands on Identity's 404 `/login?error` and the SPA can never show denial. The handler redirects to the already-validated stored target with `?error=access_denied`; the SPA callback renders the denial and stores no token.
- **No browser-driven login E2E.** GitHub OAuth cannot be exercised in a local browser test without a fake provider; Identity denial is proven by Plan 2's integration test and Plan 3's SPA callback contract test. Playwright is used only for the dynamic remote-loading E2E, which is the genuinely new runtime behavior.
- **The Identity card is a disposable fixture, not a product project.** It lives under `platform/shell/testing/identity-card`, is not under `/projects`, and is replaced by TinyURL's real remote in Plan 4. It carries a schema-valid `project.manifest.yaml` to exercise the manifest → registry-entry mechanics.
- **Deferred:** per-app detail page (cards carry all Play-Store detail fields inline), SPA packaging into the gateway jar and Docker Compose (Plan 5 infra), iframe isolation, Keycloak, Angular 22.2 upgrade (separate dependency change).

## Global Constraints

- The shell contains **no project business logic** — only routing, registry aggregation, card rendering, auth UI, and security headers (spec: Anti-Goals; Shell/Gateway).
- Remote loading is **dynamic at runtime**: no build-time `remotes` entry, no shell rebuild/redeploy when a project is added or updated (spec: Shell/Gateway "my call").
- **Remotes never receive the shell's auth token.** The shell passes no token through component inputs, globals, query parameters, or the module loader; each project's backend validates its own JWT (spec: Security boundary).
- **CSP restricts remote origins.** `script-src`/`connect-src` contain only `'self'` plus `supportfolio.shell.trusted-remote-origins`; `script-src` never contains `'unsafe-inline'` or `'unsafe-eval'` (spec: Security boundary; Microfrontend sharing foundation).
- **Shared runtime dependencies are singletons** across host and remotes: `@angular/core`, `@angular/common`, `@angular/router`, `@angular/forms`, `rxjs` with `singleton: true, strictVersion: true, requiredVersion: "auto"` in every `module-federation.config.js` (spec: Microfrontend sharing foundation).
- **Auth contract is Plan 2's, unchanged:** `GET /auth/login?redirect=`, `POST /api/token` → `{accessToken, tokenType, expiresIn, principal{id, login, email, displayName, role}}`, `GET /oauth2/jwks`, claims `sub/preferred_username/email/name/role/exp/iat`. Redirect targets must be **fragment-free**.
- **No secret is committed.** Registry paths and origins are configuration; Identity credentials/key stay env-only (GOVERNANCE.md Guardrails).
- **No PII in logs.** Registry validation warnings log only the project id (not user data); auth code/token never logged.
- Backend style: package-by-feature, one public class per file, constructor injection only, Google Java Format via Spotless (`spotlessCheck` runs in `build`) — see [CODING_STANDARDS.md](../../../platform/harness/CODING_STANDARDS.md).
- Frontend style: standalone components only, one component per file, Prettier is the formatter.
- Every commit follows Conventional Commits (`feat:`, `test:`, `ci:`, `docs:`, `chore:`).
- **Versions (verified 2026-10-20 unless marked "verify before pin"):**
  - Java `17`, Spring Boot `4.1.1` from `gradle/libs.versions.toml` / `build-logic`.
  - Spring Cloud BOM `2025.1.3` (latest stable train; Gateway `5.0.3`). *That train officially supports Boot 4.0.x; this repo is on 4.1.1.* Verify at implementation: the shell module must boot and its tests pass. If it cannot, **stop and escalate** — do not silently downgrade Boot or swap away from Gateway. `2026.0.0` is SNAPSHOT, not usable.
  - Angular `~22.1.0` (workspace pin; latest stable is `22.2.3` — do not mix versions or bump Angular inside this plan).
  - Nx `23.3.0`; `@angular-architects/module-federation` `22.0.0` (verified Angular 22 support; pulls `@angular-builders/custom-webpack@22`).
  - `@playwright/test` `1.64.1` (verified latest on npm).
  - `mockwebserver` `4.12.0` (already used by Identity).
  - Anything not listed is "verify before pin": read the tool's official release page first and record the verified version in the commit message body.
- Auth/security-touching PR: carry an OWASP checklist item (GOVERNANCE.md Policies) — this plan's price is the CSP allowlist, untrusted-origin drop, open-redirect, and token-scoping tests.

## Review Focus

The spec implies these failure modes; no happy-path test catches them. Each line pins the input, expected behavior, and owning task:

1. **A registry entry whose `remoteEntry` origin is not in the trusted allowlist must be dropped from `/api/remote-registry`, and its origin must never appear in CSP** (the registry is data, the allowlist is configuration) — pinned to Tasks 4 and 6.
2. **A malformed or missing registry file must produce a typed `503 {"error":"registry_unavailable"}` and a visible SPA error state**, never a half-rendered or silently empty grid — pinned to Tasks 4, 5, and 14.
3. **A remote that fails to load (down, CSP-blocked, bad exposed module) must degrade to a fallback card built from registry metadata**, with other cards unaffected and no unhandled rejection — pinned to Task 14.
4. **A registry rewritten on disk must be visible on the next request with no shell restart**, including a new project's card — pinned to Task 4.
5. **A denied login (`?error=access_denied`) or a missing/replayed code must leave no token in storage and must show a denial state**, not a blank page and not a retry loop — pinned to Tasks 9, 10, 11.
6. **A current URL containing a `#fragment` must produce a fragment-free redirect target, and the one-time code must be gone from the address bar after exchange** — pinned to Tasks 8 and 11.
7. **A `returnUrl` pointing off-origin must be ignored, and the bearer token must never be attached to absolute/remote URLs or `/api/token`** — pinned to Tasks 8 and 9.

---

## Task 1: Shell gateway module scaffold

**Files:**
- Modify: `settings.gradle.kts`
- Create: `platform/shell/build.gradle.kts`
- Create: `platform/shell/src/main/java/com/supportfolio/platform/shell/ShellApplication.java`
- Create: `platform/shell/src/main/resources/application.yaml`
- Create: `platform/shell/src/test/java/com/supportfolio/platform/shell/ShellApplicationTest.java`

**Interfaces:**
- Produces: Gradle project `platform:shell` applying `supportfolio.spring-service-conventions`, main class `com.supportfolio.platform.shell.ShellApplication`, port 8080. Dependencies on `spring-cloud-starter-gateway-server-webmvc` (BOM-managed), `spring-boot-starter-security`, `spring-boot-starter-oauth2-resource-server`, and `project(":platform:shared-spring-starter")`; test deps `spring-security-test`, `mockwebserver:4.12.0`.

- [ ] **Step 1: Write the failing test**

```java
@SpringBootTest
class ShellApplicationTest {
  @Test
  void contextLoads() {}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./gradlew :platform:shell:test`
Expected: FAIL — Gradle project `:platform:shell` does not exist.

- [ ] **Step 3: Add the module**

`settings.gradle.kts`: add `include("platform:shell")` after `include("platform:identity")`.

`platform/shell/build.gradle.kts`:

```kotlin
plugins {
    id("supportfolio.spring-service-conventions")
}

dependencyManagement {
    imports {
        mavenBom("org.springframework.cloud:spring-cloud-dependencies:2025.1.3")
    }
}

dependencies {
    implementation(project(":platform:shared-spring-starter"))
    implementation("org.springframework.cloud:spring-cloud-starter-gateway-server-webmvc")
    implementation("org.springframework.boot:spring-boot-starter-security")
    implementation("org.springframework.boot:spring-boot-starter-oauth2-resource-server")

    testImplementation("org.springframework.security:spring-security-test")
    testImplementation("com.squareup.okhttp3:mockwebserver:4.12.0")
}
```

`ShellApplication.java`: `@SpringBootApplication` + standard `main`. `application.yaml`: `server.port: 8080` only (security/registry properties arrive in later tasks). Do **not** enable the starter's resource server yet.

- [ ] **Step 4: Run test to verify it passes**

Run: `./gradlew :platform:shell:test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add settings.gradle.kts platform/shell
git commit -m "feat: add shell gateway module scaffold"
```

---

## Task 2: Starter public-path and CSRF configuration

The starter's Plan 2 chain authenticates every request, which would 401 the public SPA and registry. Extend it without changing the inert-by-default behavior existing consumers rely on.

**Files:**
- Modify: `platform/shared-spring-starter/src/main/java/com/supportfolio/platform/sharedstarter/security/SharedSecurityProperties.java`
- Modify: `platform/shared-spring-starter/src/main/java/com/supportfolio/platform/sharedstarter/security/IdentityResourceServerAutoConfiguration.java`
- Modify: `platform/shared-spring-starter/src/test/java/com/supportfolio/platform/sharedstarter/security/IdentityResourceServerAutoConfigurationTest.java`
- Create: `platform/shared-spring-starter/src/test/java/com/supportfolio/platform/sharedstarter/security/PublicPathsSecurityTest.java`

**Interfaces:**
- Produces:
  - `record SharedSecurityProperties(String jwkSetUri, String issuerUri, @DefaultValue List<String> permitPaths, @DefaultValue List<String> csrfIgnorePaths)` — both lists default to empty, so Plan 2 behavior is unchanged when absent.
  - Chain behavior: `requestMatchers(permitPaths).permitAll()` (only when non-empty) before `anyRequest().authenticated()`; `csrf.ignoringRequestMatchers(csrfIgnorePaths)` (only when non-empty).
- Consumes: nothing new.

- [ ] **Step 1: Write the failing tests**

In `IdentityResourceServerAutoConfigurationTest`, keep the three existing cases and add:

```java
@Test
void emptyPermitAndCsrfListsKeepPlanTwoBehavior() {
  runner.withPropertyValues(
          "supportfolio.security.resource-server.enabled=true",
          "supportfolio.security.jwk-set-uri=http://localhost:8081/oauth2/jwks",
          "supportfolio.security.issuer-uri=http://localhost:8081")
      .run(context -> {
        SharedSecurityProperties props = context.getBean(SharedSecurityProperties.class);
        assertThat(props.permitPaths()).isEmpty();
        assertThat(props.csrfIgnorePaths()).isEmpty();
      });
}
```

New `PublicPathsSecurityTest` (`@SpringBootTest` + `@AutoConfigureMockMvc`, a `@TestConfiguration` exposing a `@RestController` at `/public/ping` and `/private/ping`, and a `POST /public/echo`):

```java
@Test
void permitPathsAllowAnonymousRequests() throws Exception {
  mockMvc.perform(get("/public/ping")).andExpect(status().isOk());
}

@Test
void unlistedPathsStillRequireAuthentication() throws Exception {
  mockMvc.perform(get("/private/ping")).andExpect(status().isUnauthorized());
}

@Test
void csrfIgnorePathsAllowAnonymousPost() throws Exception {
  mockMvc.perform(post("/public/echo")).andExpect(status().isOk());
}
```

Properties: `supportfolio.security.resource-server.enabled=true`, `supportfolio.security.permit-paths=/public/**`, `supportfolio.security.csrf-ignore-paths=/public/echo`, plus dummy jwk/issuer URIs.

- [ ] **Step 2: Run tests to verify they fail**

Run: `./gradlew :platform:shared-spring-starter:test`
Expected: FAIL — `SharedSecurityProperties` has no `permitPaths()`.

- [ ] **Step 3: Implement**

Add the two components with `@DefaultValue` (same pattern as `IdentityProperties`). In the chain builder, conditionally add `authorize.requestMatchers(props.permitPaths().toArray(String[]::new)).permitAll()` before `anyRequest()`, and conditionally call `csrf.ignoringRequestMatchers(...)`. Keep the role converter and decoder exactly as they are.

- [ ] **Step 4: Run tests to verify they pass, and Plan 2 stays green**

Run: `./gradlew :platform:shared-spring-starter:test :platform:identity:test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add platform/shared-spring-starter
git commit -m "feat: add configurable public paths and csrf ignores to resource-server starter"
```

---

## Task 3: Shell resource server + session endpoint

**Files:**
- Modify: `platform/shell/src/main/resources/application.yaml`
- Create: `platform/shell/src/main/java/com/supportfolio/platform/shell/session/SessionController.java`
- Test: `platform/shell/src/test/java/com/supportfolio/platform/shell/session/SessionControllerTest.java`

**Interfaces:**
- Consumes: starter autoconfiguration (Task 2); JWT claims from Plan 2 (`sub`, `preferred_username`, `role`).
- Produces:
  - `SessionController` — `GET /api/session/me` → `200 SessionView(String id, String login, String role)` read from the `Jwt`; `401` without a token.
  - Shell properties: `supportfolio.security.resource-server.enabled=true`, `jwk-set-uri`, `issuer-uri`, `permit-paths`, `csrf-ignore-paths`.

- [ ] **Step 1: Write the failing test**

```java
@SpringBootTest(properties = {
    "supportfolio.security.resource-server.enabled=true",
    "supportfolio.security.jwk-set-uri=http://localhost:8081/oauth2/jwks",
    "supportfolio.security.issuer-uri=http://localhost:8081"
})
@AutoConfigureMockMvc
class SessionControllerTest {
  @Autowired MockMvc mockMvc;

  @Test
  void returnsClaimsFromTheValidatedJwt() throws Exception {
    mockMvc.perform(get("/api/session/me").with(jwt().jwt(jwt -> jwt
            .subject("123")
            .claim("preferred_username", "octocat")
            .claim("role", "user"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value("123"))
        .andExpect(jsonPath("$.login").value("octocat"))
        .andExpect(jsonPath("$.role").value("user"));
  }

  @Test
  void rejectsAnonymousRequests() throws Exception {
    mockMvc.perform(get("/api/session/me")).andExpect(status().isUnauthorized());
  }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./gradlew :platform:shell:test --tests "*SessionControllerTest*"`
Expected: FAIL — 404 / no controller.

- [ ] **Step 3: Implement**

`SessionController` with `@AuthenticationPrincipal Jwt jwt` and `SessionView` nested record. `application.yaml` gains (defaults shown; all env-overridable):

```yaml
supportfolio:
  security:
    resource-server:
      enabled: true
    jwk-set-uri: ${SUPPORTFOLIO_SHELL_JWK_SET_URI:http://localhost:8081/oauth2/jwks}
    issuer-uri: ${SUPPORTFOLIO_SHELL_ISSUER_URI:http://localhost:8081}
    permit-paths: /,/index.html,/signin,/auth/callback,/api/remote-registry,/api/token,/auth/login,/oauth2/**,/login/**,/assets/**,/*.js,/*.css,/*.ico
    csrf-ignore-paths: /api/token
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./gradlew :platform:shell:test --tests "*SessionControllerTest*"`
Expected: PASS (2/2).

- [ ] **Step 5: Commit**

```bash
git add platform/shell
git commit -m "feat: add shell resource-server wiring and session endpoint"
```

---

## Task 4: Remote registry loader, validation, hot reload

**Files:**
- Create: `platform/shell/src/main/java/com/supportfolio/platform/shell/registry/ExposedModule.java`
- Create: `platform/shell/src/main/java/com/supportfolio/platform/shell/registry/RemoteProject.java`
- Create: `platform/shell/src/main/java/com/supportfolio/platform/shell/registry/RemoteRegistryProperties.java`
- Create: `platform/shell/src/main/java/com/supportfolio/platform/shell/registry/RemoteRegistryException.java`
- Create: `platform/shell/src/main/java/com/supportfolio/platform/shell/registry/RemoteRegistry.java`
- Test: `platform/shell/src/test/java/com/supportfolio/platform/shell/registry/RemoteRegistryTest.java`

**Interfaces:**
- Produces (consumed by Tasks 5, 6):
  - `record ExposedModule(String name, String version, String remoteEntry)`
  - `record RemoteProject(String id, String displayName, String shortDescription, List<String> features, String openUrl, List<ExposedModule> exposedModules)`
  - `@ConfigurationProperties("supportfolio.shell") record RemoteRegistryProperties(String identityUri, String remoteRegistryFile, List<String> trustedRemoteOrigins)`
  - `RemoteRegistry(RemoteRegistryProperties, ObjectMapper)` with `List<RemoteProject> projects()` — reads the file on every call (no cache), normalizes trusted origins at construction (fail fast on an invalid entry), and throws `RemoteRegistryException` for a missing/unparsable file. `RemoteRegistryException` has `(String message)` and `(String message, Throwable cause)` constructors.
  - Validation: project `id` matches `^[a-z0-9][a-z0-9-]*$`; `displayName`/`shortDescription` non-blank; `features` non-null; `openUrl` absolute `http(s)`; `exposedModules` non-empty and contains `name == "card"`; each `version` matches `^\d+\.\d+\.\d+$`; each `remoteEntry` absolute `http(s)` whose scheme+host+port exactly matches a trusted origin. A project failing any rule is **dropped** with a warning naming only its id; a duplicate id keeps the first and warns.

- [ ] **Step 1: Write the failing tests** (JUnit `@TempDir`; helpers `registry(remoteEntry)`, `registryWith(remoteEntry)`, and `registryWithFile(path)` each write a one-project JSON to a temp file and build `RemoteRegistry` with trusted origin `http://localhost:4301`)

```java
@Test
void loadsAValidRegistryEntry() {
  assertEquals(List.of("identity"), registry.projects().stream().map(RemoteProject::id).toList());
}

@Test
void dropsProjectWhoseRemoteEntryOriginIsNotTrusted() {
  assertThat(registryWith("https://cdn.example.com.evil.com/remoteEntry.js").projects()).isEmpty();
}

@Test
void dropsProjectWithoutACardModule() { /* exposedModules only has "./widget" -> empty */ }

@Test
void dropsProjectWithNonSemverVersion() { /* version "1.0" -> empty */ }

@Test
void throwsWhenTheRegistryFileIsMissing() {
  assertThrows(RemoteRegistryException.class, () -> registryWithFile(tempDir.resolve("nope.json")).projects());
}

@Test
void throwsWhenTheRegistryIsMalformedJson() { /* "{ nope" -> RemoteRegistryException */ }

@Test
void reflectsARewrittenRegistryOnTheNextCall() throws Exception {
  assertEquals(1, registry.projects().size());
  Files.writeString(file, registryJsonWithTwoProjects());
  assertEquals(2, registry.projects().size()); // full end-to-end hot reload, Review Focus #4
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./gradlew :platform:shell:test --tests "*RemoteRegistryTest*"`
Expected: FAIL — `RemoteRegistry` does not exist.

- [ ] **Step 3: Implement the records and `RemoteRegistry`**

Read with `Files.readString` + `objectMapper.readValue(json, RegistryFile.class)` (a private record wrapping `List<RemoteProject> projects`); compare origins with `URI.create(...)` scheme/host/port, lowercased, default port normalized. Trusted-origin parsing throws `IllegalStateException` for entries with a path/query/fragment or non-http(s) scheme.

- [ ] **Step 4: Run test to verify it passes**

Run: `./gradlew :platform:shell:test --tests "*RemoteRegistryTest*"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add platform/shell
git commit -m "feat: add validated hot-reloaded remote registry loader"
```

---

## Task 5: Registry endpoint, sample registry, run docs

**Files:**
- Create: `platform/shell/src/main/java/com/supportfolio/platform/shell/registry/RemoteRegistryController.java`
- Create: `platform/shell/config/remote-registry.json`
- Create: `platform/shell/README.md`
- Modify: `platform/shell/src/main/resources/application.yaml` (add `supportfolio.shell.*` defaults)
- Test: `platform/shell/src/test/java/com/supportfolio/platform/shell/registry/RemoteRegistryControllerTest.java`

**Interfaces:**
- Consumes: `RemoteRegistry.projects()` (Task 4), `RemoteRegistryException`.
- Produces:
  - `GET /api/remote-registry` → `200 {"projects":[{id, displayName, shortDescription, features[], openUrl, exposedModules:[{name,version,remoteEntry}]}]}`.
  - Failure → `503 {"error":"registry_unavailable"}` (no file path or validation detail leaked).
  - Config defaults: `supportfolio.shell.identity-uri` (`SUPPORTFOLIO_SHELL_IDENTITY_URI`, default `http://localhost:8081`), `remote-registry-file` (`SUPPORTFOLIO_SHELL_REMOTE_REGISTRY_FILE`, default `platform/shell/config/remote-registry.json`), `trusted-remote-origins` (`SUPPORTFOLIO_SHELL_TRUSTED_REMOTE_ORIGINS`, default `http://localhost:4301`).

- [ ] **Step 1: Write the failing tests** (standalone MockMvc; stub `RemoteRegistry` via Mockito)

```java
@Test
void returnsProjectsFromTheRegistry() throws Exception {
  mockMvc.perform(get("/api/remote-registry"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.projects[0].id").value("identity"))
      .andExpect(jsonPath("$.projects[0].exposedModules[0].name").value("card"));
}

@Test
void returnsTypedErrorWhenTheRegistryCannotBeRead() throws Exception {
  when(registry.projects()).thenThrow(new RemoteRegistryException("bad file", new RuntimeException()));
  mockMvc.perform(get("/api/remote-registry"))
      .andExpect(status().isServiceUnavailable())
      .andExpect(jsonPath("$.error").value("registry_unavailable"));
}
```

- [ ] **Step 2: Run to verify failure**

Run: `./gradlew :platform:shell:test --tests "*RemoteRegistryControllerTest*"`
Expected: FAIL — controller missing.

- [ ] **Step 3: Implement the controller and the sample registry**

Controller catches `RemoteRegistryException`, logs the message (no PII), returns the typed 503. `platform/shell/config/remote-registry.json`:

```json
{
  "projects": [
    {
      "id": "identity",
      "displayName": "Identity",
      "shortDescription": "Single sign-on and JWT issuance for every Supportfolio project.",
      "features": ["GitHub sign-in", "JWT issuance", "JWKS publication"],
      "openUrl": "http://localhost:8081",
      "exposedModules": [
        { "name": "card", "version": "1.0.0", "remoteEntry": "http://localhost:4301/remoteEntry.js" }
      ]
    }
  ]
}
```

`README.md`: run order (identity with its Plan 2 env vars → `npx nx serve identity-card --port 4301` → shell with the three `SUPPORTFOLIO_SHELL_*` env vars → `npx nx serve shell-host`), the registry JSON contract, "CD rewrites this file; never rebuild the shell", the trusted-origin rule, and the dev-vs-prod Identity URL note from Scope decisions.

- [ ] **Step 4: Run test to verify it passes**

Run: `./gradlew :platform:shell:test --tests "*RemoteRegistryControllerTest*"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add platform/shell
git commit -m "feat: expose remote registry endpoint with typed failure"
```

---

## Task 6: CSP and security headers from the trusted-origin allowlist

**Files:**
- Create: `platform/shell/src/main/java/com/supportfolio/platform/shell/web/CspPolicy.java`
- Create: `platform/shell/src/main/java/com/supportfolio/platform/shell/web/SecurityHeadersFilter.java`
- Test: `platform/shell/src/test/java/com/supportfolio/platform/shell/web/CspPolicyTest.java`
- Test: `platform/shell/src/test/java/com/supportfolio/platform/shell/web/SecurityHeadersFilterTest.java`

**Interfaces:**
- Consumes: `RemoteRegistryProperties.trustedRemoteOrigins()` (Task 4).
- Produces:
  - `CspPolicy(List<String> trustedOrigins)` with `String headerValue()` — normalizes each origin to scheme+host+port at construction (invalid → `IllegalStateException`), then emits exactly:
    `default-src 'self'; script-src 'self' <origins>; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' <origins>; frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'`
  - `SecurityHeadersFilter extends OncePerRequestFilter` setting `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`. Registered as a `@Bean FilterRegistrationBean` with order `Ordered.HIGHEST_PRECEDENCE`.

- [ ] **Step 1: Write the failing tests**

```java
@Test
void scriptSrcAllowsSelfAndTrustedOriginsOnly() {
  String csp = new CspPolicy(List.of("http://localhost:4301", "https://cdn.example.com")).headerValue();
  assertTrue(csp.contains("script-src 'self' http://localhost:4301 https://cdn.example.com"));
  assertFalse(csp.contains("'unsafe-eval'"));
  assertTrue(Arrays.stream(csp.split(";")).noneMatch(d -> d.trim().startsWith("script-src") && d.contains("'unsafe-inline'")));
  assertTrue(csp.contains("frame-ancestors 'none'"));
}

@Test
void lookalikeOriginIsNotTrustedBecauseTheListIsExact() {
  String csp = new CspPolicy(List.of("https://cdn.example.com")).headerValue();
  assertFalse(csp.contains("cdn.example.com.evil.com"));
}
```

`SecurityHeadersFilterTest` (MockMvc, any permitted endpoint): response has the four headers; CSP equals `new CspPolicy(props.trustedRemoteOrigins()).headerValue()`.

- [ ] **Step 2: Run to verify failure**

Run: `./gradlew :platform:shell:test --tests "*CspPolicyTest*"`
Expected: FAIL — class missing.

- [ ] **Step 3: Implement**

`CspPolicy` joins origins with single spaces, `String.join`. Filter writes the header on every response. Origins are configuration, never taken from registry entries.

- [ ] **Step 4: Run tests to verify they pass**

Run: `./gradlew :platform:shell:test --tests "*Csp*" --tests "*SecurityHeadersFilterTest*"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add platform/shell
git commit -m "feat: add csp and security headers from trusted remote origins"
```

---

## Task 7: Gateway routes + same-origin SPA fallback

**Files:**
- Modify: `platform/shell/src/main/resources/application.yaml` (gateway routes)
- Create: `platform/shell/src/main/java/com/supportfolio/platform/shell/web/SpaForwardController.java`
- Create: `platform/shell/src/test/resources/test-static/index.html`
- Test: `platform/shell/src/test/java/com/supportfolio/platform/shell/web/GatewayRoutingTest.java`

**Interfaces:**
- Consumes: `supportfolio.shell.identity-uri` (Task 5); Identity's endpoints (Plan 2).
- Produces:
  - Routes: `/api/token`, `/auth/login`, `/oauth2/**`, `/login/**` → `uri: ${supportfolio.shell.identity-uri}`. `/auth/callback` and `/signin` are **not** proxied (exact `/auth/login` only).
  - `SpaForwardController` — `GET /`, `/signin`, `/auth/callback`, `/projects/**` → `forward:/index.html`.
- Test-only static location: `spring.web.resources.static-locations=classpath:/test-static/`.

- [ ] **Step 1: Write the failing tests** (`@SpringBootTest(RANDOM_PORT)`, `@DynamicPropertySource` pointing `supportfolio.shell.identity-uri` at a static `MockWebServer`)

```java
@Test
void forwardsTokenExchangeToIdentityWithBodyAndQueryIntact() {
  mockIdentity.enqueue(new MockResponse().setResponseCode(200).setBody("{\"accessToken\":\"t\"}"));
  HttpHeaders json = new HttpHeaders();
  json.setContentType(MediaType.APPLICATION_JSON);
  ResponseEntity<String> response = rest.postForEntity(
      "/api/token", new HttpEntity<>(Map.of("code", "abc"), json), String.class);
  assertEquals(200, response.getStatusCode().value());
  RecordedRequest forwarded = mockIdentity.takeRequest();
  assertEquals("/api/token", forwarded.getPath());
  assertTrue(forwarded.getBody().readUtf8().contains("\"code\":\"abc\""));
}

@Test
void forwardsLoginStartWithItsRedirectParam() {
  mockIdentity.enqueue(new MockResponse().setResponseCode(302).setHeader("Location", "/oauth2/authorization/github"));
  rest.getForEntity("/auth/login?redirect=http%3A%2F%2Flocalhost%3A4200%2Fauth%2Fcallback", String.class);
  assertTrue(mockIdentity.takeRequest().getPath().startsWith("/auth/login?redirect="));
}

@Test
void servesTheSpaShellForClientRoutes() {
  assertTrue(rest.getForEntity("/signin", String.class).getBody().contains("shell-test-index"));
}

@Test
void keepsTheSpaCallbackRouteLocal() {
  // GET /auth/callback?code=x -> 200 index HTML (never hits MockWebServer)
}
```

- [ ] **Step 2: Run to verify failure**

Run: `./gradlew :platform:shell:test --tests "*GatewayRoutingTest*"`
Expected: FAIL — routes/forward absent.

- [ ] **Step 3: Implement**

Add the yaml routes under `spring.cloud.gateway.server.webmvc.routes` with ids `identity-token`, `identity-login-start`, `identity-oauth`. `SpaForwardController` returns `"forward:/index.html"`. Test resource `test-static/index.html` contains `shell-test-index`.

- [ ] **Step 4: Run to verify pass**

Run: `./gradlew :platform:shell:test --tests "*GatewayRoutingTest*"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add platform/shell
git commit -m "feat: route identity endpoints and serve same-origin spa shell"
```

---

## Task 8: Shared auth — fragment-free redirects and safe return URLs

**Files:**
- Create: `platform/shared-ui-lib/src/lib/auth/redirect-url.ts`
- Test: `platform/shared-ui-lib/src/lib/auth/redirect-url.spec.ts`
- Modify: `platform/shared-ui-lib/src/index.ts`

**Interfaces:**
- Produces (used by Tasks 9, 11):
  - `stripFragment(url: string): string` — removes `#...` including the `#`.
  - `buildLoginRedirectUrl(identityLoginBaseUrl: string, callbackUrl: string): string` → `${identityLoginBaseUrl}/auth/login?redirect=${encodeURIComponent(stripFragment(callbackUrl))}`.
  - `safeReturnUrl(raw: string | null, origin: string): string` — returns `raw` only when it is a path starting with a single `/` (not `//`); a same-origin absolute URL is reduced to path+query+hash; anything else returns `/`.

- [ ] **Step 1: Write the failing tests**

```ts
it('strips fragments and encodes the callback target exactly once', () => {
  expect(buildLoginRedirectUrl('http://localhost:8081', 'http://localhost:4200/auth/callback#/tab'))
    .toBe('http://localhost:8081/auth/login?redirect=http%3A%2F%2Flocalhost%3A4200%2Fauth%2Fcallback');
});

it('keeps queries but drops fragments', () => {
  expect(stripFragment('/app?tab=1#frag')).toBe('/app?tab=1');
  expect(stripFragment('/app#/route')).toBe('/app');
});

it('ignores off-origin and protocol-relative return targets', () => {
  expect(safeReturnUrl('https://evil.example/x', 'http://localhost:4200')).toBe('/');
  expect(safeReturnUrl('//evil.example/x', 'http://localhost:4200')).toBe('/');
  expect(safeReturnUrl('javascript:alert(1)', 'http://localhost:4200')).toBe('/');
});

it('accepts same-origin paths and same-origin absolute URLs', () => {
  expect(safeReturnUrl('/projects/identity', 'http://localhost:4200')).toBe('/projects/identity');
  expect(safeReturnUrl('http://localhost:4200/signin', 'http://localhost:4200')).toBe('/signin');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test shared-ui-lib --testPathPattern=redirect-url`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the three pure functions** and export them from `src/index.ts`. No Angular imports; no DOM APIs (use string splitting for the fragment).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx test shared-ui-lib --testPathPattern=redirect-url`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add platform/shared-ui-lib
git commit -m "feat: add fragment-free auth redirect helpers"
```

---

## Task 9: Shared auth — token store, code exchange, bearer scoping

**Files:**
- Create: `platform/shared-ui-lib/src/lib/auth/auth.types.ts`
- Create: `platform/shared-ui-lib/src/lib/auth/auth.config.ts`
- Create: `platform/shared-ui-lib/src/lib/auth/auth-token.store.ts`
- Create: `platform/shared-ui-lib/src/lib/auth/auth.service.ts`
- Create: `platform/shared-ui-lib/src/lib/auth/auth.interceptor.ts`
- Test: `platform/shared-ui-lib/src/lib/auth/auth-token.store.spec.ts`
- Test: `platform/shared-ui-lib/src/lib/auth/auth.service.spec.ts`
- Test: `platform/shared-ui-lib/src/lib/auth/auth.interceptor.spec.ts`
- Modify: `platform/shared-ui-lib/src/index.ts`

**Interfaces:**
- Consumes: Plan 2's `POST /api/token`; `buildLoginRedirectUrl`, `safeReturnUrl` (Task 8).
- Produces (used by Task 11):
  - `interface AuthConfig { identityLoginBaseUrl: string; apiBaseUrl: string; callbackPath: string }`
  - `interface Principal { id: string; login: string; email: string | null; displayName: string; role: 'admin' | 'user' }`
  - `interface AuthSession { accessToken: string; principal: Principal; expiresAt: number }`
  - `class LoginDeniedError extends Error`
  - `class AuthTokenStore` — signal `session`, `token(): string | null` (clears an expired session), `set(session)`, `clear()`; persists to `sessionStorage` key `supportfolio.auth.session` and hydrates on construction (invalid JSON clears).
  - `class AuthService` — `login(): void` (stores `safeReturnUrl(router.url, origin)` under `supportfolio.auth.return-url`, then navigates to `buildLoginRedirectUrl(config.identityLoginBaseUrl, origin + config.callbackPath)` through `EXTERNAL_NAVIGATOR`), `completeLogin(code: string): Promise<Principal>` (`POST ${apiBaseUrl}/api/token` body `{code}`; stores the session with `expiresAt = Date.now() + expiresIn * 1000`; any non-2xx → `LoginDeniedError` and no storage), `logout()`, `consumeReturnUrl(): string`.
  - `EXTERNAL_NAVIGATOR` injection token `(url: string) => void`, default `window.location.assign`.
  - `authInterceptor: HttpInterceptorFn` — adds `Authorization: Bearer <token>` only for URLs starting with `/api/` **and not** `/api/token`; never for absolute URLs.

- [ ] **Step 1: Write the failing tests**

```ts
// auth-token.store.spec.ts
it('persists a session for the tab and clears it on logout', () => {
  store.set({ accessToken: 't', principal: principal(), expiresAt: Date.now() + 60_000 });
  expect(sessionStorage.getItem('supportfolio.auth.session')).toContain('"accessToken":"t"');
  expect(store.token()).toBe('t');
  store.clear();
  expect(store.token()).toBeNull();
});

it('treats an expired session as signed out', () => {
  store.set({ accessToken: 't', principal: principal(), expiresAt: Date.now() - 1 });
  expect(store.token()).toBeNull();
  expect(sessionStorage.getItem('supportfolio.auth.session')).toBeNull();
});

// auth.service.spec.ts (HttpTestingController)
it('exchanges a code for the identity token contract and stores the session', async () => {
  const promise = service.completeLogin('abc');
  const req = http.expectOne('/api/token');
  expect(req.request.method).toBe('POST');
  expect(req.request.body).toEqual({ code: 'abc' });
  req.flush({ accessToken: 'jwt', tokenType: 'Bearer', expiresIn: 3600, principal: principal() });
  await expect(promise).resolves.toEqual(principal());
  expect(store.token()).toBe('jwt');
});

it('stores nothing when the code is rejected', async () => {
  const promise = service.completeLogin('used');
  http.expectOne('/api/token').flush({ error: 'invalid_code' }, { status: 400, statusText: 'Bad Request' });
  await expect(promise).rejects.toBeInstanceOf(LoginDeniedError);
  expect(store.token()).toBeNull();
});

// auth.interceptor.spec.ts
it('attaches the bearer only to protected same-origin api calls', () => {
  store.set({ accessToken: 'jwt', principal: principal(), expiresAt: Date.now() + 60_000 });
  http.get('/api/session/me').subscribe();
  expect(http.expectOne('/api/session/me').request.headers.get('Authorization')).toBe('Bearer jwt');
});

it('never attaches the token to the token endpoint or a remote origin', () => {
  http.get('http://localhost:4301/remoteEntry.js').subscribe();
  expect(http.expectOne('http://localhost:4301/remoteEntry.js').request.headers.has('Authorization')).toBe(false);
  http.post('/api/token', { code: 'x' }).subscribe();
  expect(http.expectOne('/api/token').request.headers.has('Authorization')).toBe(false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx nx test shared-ui-lib --testPathPattern=auth`
Expected: FAIL — modules missing.

- [ ] **Step 3: Implement** the five files as declared. Clear `sessionStorage` in each spec's `beforeEach`. The store is constructed once per test (`new AuthTokenStore()`); the service takes the store, `HttpClient`, `Router`, `AuthConfig`, and the navigator function.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx nx test shared-ui-lib --testPathPattern=auth`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add platform/shared-ui-lib
git commit -m "feat: add shared auth token store, code exchange, and bearer scoping"
```

---

## Task 10: Identity login-failure handler (Plan 2 handoff)

**Files:**
- Create: `platform/identity/src/main/java/com/supportfolio/platform/identity/login/LoginFailureHandler.java`
- Modify: `platform/identity/src/main/java/com/supportfolio/platform/identity/login/SecurityConfig.java`
- Test: `platform/identity/src/test/java/com/supportfolio/platform/identity/login/LoginFailureHandlerTest.java`

**Interfaces:**
- Consumes: `LoginRedirectController.REDIRECT_ATTRIBUTE` (Plan 2); the redirect target was already origin-validated before login.
- Produces: `LoginFailureHandler implements AuthenticationFailureHandler` — 302 to `<stored target>` + (`?` or `&`) + `error=access_denied`; no stored target → `400`. It never mints a code. `SecurityConfig` replaces `.failureUrl("/login?error")` with `.failureHandler(...)`.

- [ ] **Step 1: Write the failing tests**

```java
@Test
void redirectsDeniedUsersBackToTheAlreadyValidatedTarget() {
  // session target https://shell.example.com/auth/callback -> 302 .../auth/callback?error=access_denied
}

@Test
void appendsWithAnAmpersandWhenTheTargetHasAQuery() { /* ...?tab=1&error=access_denied */ }

@Test
void returnsBadRequestWithoutAStoredTarget() { /* status 400 */ }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./gradlew :platform:identity:test --tests "*LoginFailureHandlerTest*"`
Expected: FAIL — class missing.

- [ ] **Step 3: Implement the handler and wire it as a `SecurityConfig` bean**; keep `failureUrl` out of the chain.

- [ ] **Step 4: Run tests to verify they pass, including Plan 2's flow**

Run: `./gradlew :platform:identity:test`
Expected: PASS (existing suite + 3 new).

- [ ] **Step 5: Commit**

```bash
git add platform/identity
git commit -m "feat: redirect denied logins back to the requesting app"
```

---

## Task 11: Shared auth — login page, callback, providers

**Files:**
- Create: `platform/shared-ui-lib/src/lib/auth/login-page.component.ts`
- Create: `platform/shared-ui-lib/src/lib/auth/login-page.component.html`
- Create: `platform/shared-ui-lib/src/lib/auth/auth-callback.component.ts`
- Create: `platform/shared-ui-lib/src/lib/auth/auth-callback.component.html`
- Create: `platform/shared-ui-lib/src/lib/auth/provide-auth.ts`
- Test: `platform/shared-ui-lib/src/lib/auth/login-page.component.spec.ts`
- Test: `platform/shared-ui-lib/src/lib/auth/auth-callback.component.spec.ts`
- Modify: `platform/shared-ui-lib/src/index.ts`

**Interfaces:**
- Consumes: `AuthService`, `AuthTokenStore`, `AuthConfig`, `safeReturnUrl` (Tasks 8, 9).
- Produces (used by Task 12):
  - `LoginPageComponent` (standalone) — button `data-testid="sign-in"` calls `login()`; renders `data-testid="login-denied"` when `AuthService` reports a denied state (a `lastError = signal<'denied' | null>` on the service, set by the callback).
  - `AuthCallbackComponent` (standalone) — reads `code` and `error` from the query; `error=access_denied` → sets denied, stores nothing, renders `data-testid="login-denied"`; `code` present → `completeLogin(code)`, then `router.navigateByUrl(consumeReturnUrl(), { replaceUrl: true })` (drops `?code` from the address bar); missing both → `data-testid="login-error"`.
  - `provideAuth(config: Partial<AuthConfig> = {}): EnvironmentProviders` registering `AUTH_CONFIG` (defaults `identityLoginBaseUrl: 'http://localhost:8081'`, `apiBaseUrl: ''`, `callbackPath: '/auth/callback'`), `AuthTokenStore`, `AuthService`, `EXTERNAL_NAVIGATOR`.

- [ ] **Step 1: Write the failing tests**

```ts
it('signs in through the identity login entry point', async () => {
  const navigate = jest.fn();
  await render(LoginPageComponent, { providers: [/* real provideAuth with fake navigator */] });
  screen.getByTestId('sign-in').click();
  expect(navigate).toHaveBeenCalledWith(expect.stringContaining('/auth/login?redirect='));
});

it('shows denial and stores no token when identity returns an error', async () => {
  const store = new AuthTokenStore();
  await render(AuthCallbackComponent, { providers: [store, fakeAuthService({ completeLogin: jest.fn() }), fakeRoute({ error: 'access_denied' })] });
  expect(screen.getByTestId('login-denied')).toBeTruthy();
  expect(store.token()).toBeNull();
});

it('exchanges the code and navigates away with replaceUrl to clean the address bar', async () => {
  // code=abc, stored return URL /projects/identity -> completeLogin('abc'), router.navigateByUrl('/projects/identity', { replaceUrl: true })
});

it('ignores an off-origin stored return URL', async () => {
  // return URL https://evil.example -> navigateByUrl('/', ...)
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx nx test shared-ui-lib --testPathPattern="login-page|auth-callback"`
Expected: FAIL — components missing.

- [ ] **Step 3: Implement the components** (small standalone templates; no NgModules) and `provideAuth`. `AuthService` gains `lastError` signal and `clearError()`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx nx test shared-ui-lib --testPathPattern="login-page|auth-callback"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add platform/shared-ui-lib
git commit -m "feat: add shared login and auth callback components"
```

---

## Task 12: Angular host app scaffold with dynamic Module Federation

**Files:**
- Create (generated): `platform/shell/host/**` (Nx project `shell-host`, standalone, routing, CSS, Jest)
- Create/modify: `platform/shell/host/src/main.ts` and `src/bootstrap.ts` (split by the MF setup)
- Create: `platform/shell/host/src/environments/environment.ts`
- Create: `platform/shell/host/src/environments/environment.e2e.ts`
- Create: `platform/shell/host/proxy.conf.json`
- Test: `platform/shell/host/src/app/app.component.spec.ts`

**Interfaces:**
- Consumes: `provideAuth` (Task 11).
- Produces: Nx project `shell-host` at `platform/shell/host`, routes `/` (catalog, Task 14), `/signin`, `/auth/callback`; `environment.apiBaseUrl = ''`, `environment.registryUrl = '/api/remote-registry'`; `environment.e2e.ts` sets `registryUrl = '/e2e/remote-registry.json'`; dev-server proxy sends `/api` and `/auth/login` to `http://localhost:8080`.
- MF config: `name: 'shell-host'`, `remotes: []` at build time, shared singletons for `@angular/core`, `@angular/common`, `@angular/router`, `@angular/forms`, `rxjs`.

- [ ] **Step 1: Generate the app and MF wiring**

```bash
npx nx g @nx/angular:application shell-host --directory=platform/shell/host --routing --style=css --unitTestRunner=jest --e2eTestRunner=none --ssr=false --bundler=webpack
npx nx g @angular-architects/module-federation:init --project shell-host --port 4200 --type host
```

Then edit the generated `module-federation.config.js`: keep `name: 'shell-host'` and `remotes: []` (dynamic loading only), keep the generated `shared` block, and confirm the listed five packages are `singleton: true, strictVersion: true, requiredVersion: 'auto'`. Remove any generated remote entries. Add `src/environments/*.ts` and the `e2e` file replacement in `project.json`.

- [ ] **Step 2: Write the failing test**

```ts
it('renders the shell header and the router outlet', async () => {
  const { fixture } = await render(AppComponent, { imports: [RouterTestingModule] });
  expect(fixture.nativeElement.querySelector('[data-testid="shell-header"]').textContent).toContain('Supportfolio');
  expect(fixture.nativeElement.querySelector('router-outlet')).toBeTruthy();
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx nx test shell-host`
Expected: FAIL — header test id absent.

- [ ] **Step 4: Implement the shell chrome** — header with `data-testid="shell-header"`, `<router-outlet />`, `app.config.ts` with `provideRouter(routes)`, `provideHttpClient(withInterceptors([authInterceptor]))`, `provideAuth({})`; wire `/signin` and `/auth/callback` to Task 11 components; `main.ts` must keep the MF dynamic import of `./bootstrap`.

- [ ] **Step 5: Verify build and tests**

Run: `npx nx test shell-host && npx nx build shell-host`
Expected: PASS and BUILD SUCCESSFUL (host bundle; no build-time remote).

- [ ] **Step 6: Commit**

```bash
git add platform/shell/host package.json package-lock.json
git commit -m "feat: add angular shell host with dynamic module federation"
```

---

## Task 13: Registry client and federated loader

**Files:**
- Create: `platform/shell/host/src/app/catalog/registry.types.ts`
- Create: `platform/shared-ui-lib/src/lib/federated/card-contract.ts`
- Create: `platform/shell/host/src/app/catalog/federated-loader.ts`
- Create: `platform/shell/host/src/app/catalog/remote-registry.providers.ts`
- Create: `platform/shell/host/src/app/catalog/catalog.service.ts`
- Test: `platform/shell/host/src/app/catalog/federated-loader.spec.ts`
- Test: `platform/shell/host/src/app/catalog/remote-registry.providers.spec.ts`
- Test: `platform/shell/host/src/app/catalog/catalog.service.spec.ts`
- Modify: `platform/shared-ui-lib/src/index.ts`

**Interfaces:**
- Consumes: Plan 1's `RemoteRegistryService`, `RemoteModuleEntry` (shared-ui-lib); `environment.registryUrl`.
- Produces (used by Task 14):
  - `interface RemoteCardComponent { title: string; description: string; features: string[]; openUrl: string }` in `shared-ui-lib` — the exposed `./card` contract.
  - `interface RemoteProjectDto { id: string; displayName: string; shortDescription: string; features: string[]; openUrl: string; exposedModules: { name: string; version: string; remoteEntry: string }[] }` — the wire shape of one `projects[]` element.
  - `interface RemoteProject { id; displayName; shortDescription; features: string[]; openUrl: string; exposedModules: RemoteModuleEntry[] }`
  - `toRemoteProject(dto: RemoteProjectDto): RemoteProject` and `toRemoteModuleEntries(projects: RemoteProject[]): RemoteModuleEntry[]` — the latter injects `projectId` into each exposed module.
  - `loadFederatedCard(entry: RemoteModuleEntry): Promise<Type<RemoteCardComponent>>` — calls `loadRemoteModule({ remoteEntry: entry.remoteEntry, remoteName: entry.projectId, exposedModule: './' + entry.moduleName })`, then returns `module.default`; throws `Error('Exposed module ./card has no default component')` when the default export is absent.
  - `provideRemoteRegistry(registryUrl: string): Provider[]` — builds `RemoteRegistryService` with an `HttpClient` fetcher and `loadFederatedCard` as the loader, so `resolveModule(...).load()` resolves to the component type.
  - `CatalogService.loadProjects(): Promise<RemoteProject[]>` — `GET registryUrl`, flattens, throws `RegistryUnavailableError` on non-2xx.

- [ ] **Step 1: Write the failing tests**

```ts
jest.mock('@angular-architects/module-federation', () => ({ loadRemoteModule: jest.fn() }));

it('loads a module by explicit remoteEntry, never by build-time name alone', async () => {
  (loadRemoteModule as jest.Mock).mockResolvedValue({ default: FakeCard });
  await expect(loadFederatedCard({ projectId: 'identity', moduleName: 'card', version: '1.0.0', remoteEntry: 'http://localhost:4301/remoteEntry.js' })).resolves.toBe(FakeCard);
  expect(loadRemoteModule).toHaveBeenCalledWith({
    remoteEntry: 'http://localhost:4301/remoteEntry.js',
    remoteName: 'identity',
    exposedModule: './card',
  });
});

it('fails with a typed error when a remote omits the card default export', async () => {
  (loadRemoteModule as jest.Mock).mockResolvedValue({});
  await expect(loadFederatedCard(entry)).rejects.toThrow('./card');
});

it('maps registry projects onto flat module entries', () => { /* one project, one module -> projectId injected */ });

it('surfaces a typed error when the registry endpoint fails', async () => {
  http.expectOne('/api/remote-registry').flush({ error: 'registry_unavailable' }, { status: 503, statusText: 'Unavailable' });
  await expect(service.loadProjects()).rejects.toBeInstanceOf(RegistryUnavailableError);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx nx test shell-host --testPathPattern=catalog`
Expected: FAIL — modules missing.

- [ ] **Step 3: Implement** the five files. `RemoteRegistryService.resolveModule(projectId, 'card')` returns `{ entry, load }`; the provider passes `loadFederatedCard` as that loader, so `load()` resolves to the component type.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx nx test shell-host --testPathPattern=catalog`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add platform/shell/host
git commit -m "feat: wire registry-driven federated card loading"
```

---

## Task 14: Card grid, dynamic card host, fallback

**Files:**
- Create: `platform/shell/host/src/app/catalog/remote-card-host.component.ts`
- Create: `platform/shell/host/src/app/catalog/catalog-page.component.ts`
- Create: `platform/shell/host/src/app/catalog/catalog-page.component.html`
- Create: `platform/shell/host/src/app/catalog/remote-card-host.component.spec.ts`
- Create: `platform/shell/host/src/app/catalog/catalog-page.component.spec.ts`
- Modify: `platform/shell/host/src/app/app.routes.ts`

**Interfaces:**
- Consumes: `CatalogService`, `loadFederatedCard`, `RemoteRegistryService`, `CardComponent`, `RemoteCardComponent` (shared-ui-lib; contract created in Task 13).
- Produces:
  - `RemoteCardHostComponent` — input `project: RemoteProject`; resolves `card` via `RemoteRegistryService`, `load()` (the component type), then `ViewContainerRef.createComponent` + `setInput` for the four contract fields; on any failure creates `CardComponent` instead (same inputs). Renders `data-testid="remote-card-<id>"` when remote-backed.
  - `CatalogPageComponent` — `loadProjects()` on init; grid of `RemoteCardHostComponent`, each wrapped in an element with `data-testid="project-card-<id>"`; error state `data-testid="registry-error"`.
  - Card grid styling: dark `#121417` page, `#1c1f26` cards, 12px radius, `grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))`, content-forward typography; "Open" opens `openUrl` in a new tab with `noopener,noreferrer`.

- [ ] **Step 1: Write the failing tests**

```ts
it('renders the remote component with registry metadata when loading succeeds', async () => {
  const { fixture } = await render(RemoteCardHostComponent, {
    inputs: { project },
    providers: [{ provide: RemoteRegistryService, useValue: fakeRegistryResolving(FakeRemoteCard) }],
  });
  await fixture.whenStable();
  expect(fixture.nativeElement.querySelector('[data-testid="remote-card-identity"]')).toBeTruthy();
  expect(fixture.nativeElement.textContent).toContain('Identity');
});

it('falls back to the shared card when the remote cannot be loaded', async () => {
  const { fixture } = await render(RemoteCardHostComponent, {
    inputs: { project },
    providers: [{ provide: RemoteRegistryService, useValue: fakeRegistryRejecting(new Error('boom')) }],
  });
  await fixture.whenStable();
  expect(fixture.nativeElement.textContent).toContain('Identity');
  expect(fixture.nativeElement.querySelector('[data-testid="open-action"]')).toBeTruthy();
  expect(fixture.nativeElement.querySelector('[data-testid^="remote-card-"]')).toBeNull();
});

it('renders one card per registry project', async () => { /* two projects -> two app-remote-card nodes */ });

it('shows a registry error state instead of an empty grid', async () => {
  const { fixture } = await render(CatalogPageComponent, { providers: [{ provide: CatalogService, useValue: failingCatalog() }] });
  await fixture.whenStable();
  expect(fixture.nativeElement.querySelector('[data-testid="registry-error"]')).toBeTruthy();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx nx test shell-host --testPathPattern=catalog-page`
Expected: FAIL — components missing.

- [ ] **Step 3: Implement** the host component, page, and styles. The remote host catches both rejection and a missing default export. `CatalogPageComponent` catches and renders the error state; it never renders a partial grid on a registry failure.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx nx test shell-host --testPathPattern=catalog-page`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add platform/shell/host
git commit -m "feat: render project card grid with remote cards and fallback"
```

---

## Task 15: Identity card fixture remote + manifest

**Files:**
- Create (generated): `platform/shell/testing/identity-card/**` (Nx project `identity-card`, standalone, CSS, Jest)
- Create/modify: `platform/shell/testing/identity-card/src/app/identity-card.component.ts` + `.html`
- Create/modify: `platform/shell/testing/identity-card/module-federation.config.js` (exposes `./card`)
- Create: `platform/shell/testing/identity-card/project.manifest.yaml`
- Test: `platform/shell/testing/identity-card/src/app/identity-card.component.spec.ts`
- Test: `tools/validate-shell-fixtures.spec.ts`

**Interfaces:**
- Consumes: `CardComponent` and `RemoteCardComponent` from `shared-ui-lib`; same shared-singleton config as the host.
- Produces: remote `identity`, exposes `'./card': <path to identity-card.component.ts>`, default export `IdentityCardComponent implements RemoteCardComponent`; inputs `title`, `description`, `features`, `openUrl`; template delegates to `<lib-card>` and tags the root `data-testid="remote-card-identity"`; `openUrl` default `http://localhost:8081`. Manifest validates against `platform/harness/manifest-schema/project.manifest.schema.json`.

- [ ] **Step 1: Generate and configure**

```bash
npx nx g @nx/angular:application identity-card --directory=platform/shell/testing/identity-card --routing=false --style=css --unitTestRunner=jest --e2eTestRunner=none --ssr=false --bundler=webpack
npx nx g @angular-architects/module-federation:init --project identity-card --port 4301 --type remote
```

Set `module-federation.config.js`: `name: 'identity'`, `exposes: { './card': 'platform/shell/testing/identity-card/src/app/identity-card.component.ts' }`, same shared singletons as Task 12.

- [ ] **Step 2: Write the failing tests**

```ts
it('renders the identity card content through the shared card', async () => {
  const { fixture } = await render(IdentityCardComponent, {
    inputs: { title: 'Identity', description: 'SSO', features: ['GitHub sign-in'], openUrl: 'http://localhost:8081' },
  });
  expect(fixture.nativeElement.querySelector('[data-testid="remote-card-identity"]')).toBeTruthy();
  expect(fixture.nativeElement.textContent).toContain('GitHub sign-in');
});
```

`tools/validate-shell-fixtures.spec.ts`: reads the manifest and asserts `validateManifest(...).valid === true`, and that `id === 'identity'` with a `card` exposed module; also asserts the MF config file contains `'./card'`.

- [ ] **Step 3: Run to verify failure**

Run: `npx nx test identity-card`
Expected: FAIL — component missing.

- [ ] **Step 4: Implement the component and manifest** (features: GitHub sign-in, JWT issuance, JWKS publication; `exposedModules: [{ name: card, version: 1.0.0, remoteEntry: http://localhost:4301/remoteEntry.js }]`).

- [ ] **Step 5: Verify component test, fixture test, and remote build**

Run: `npx nx test identity-card && npx jest tools/validate-shell-fixtures.spec.ts && npx nx build identity-card`
Expected: PASS; `dist/platform/shell/testing/identity-card/remoteEntry.js` exists (webpack Module Federation remote entry).

- [ ] **Step 6: Commit**

```bash
git add platform/shell/testing tools/validate-shell-fixtures.spec.ts
git commit -m "feat: add fixture identity card remote and manifest"
```

---

## Task 16: Playwright E2E — dynamic remote loading

**Files:**
- Create: `platform/shell/host-e2e/project.json`
- Create: `platform/shell/host-e2e/playwright.config.ts`
- Create: `platform/shell/host-e2e/src/dynamic-remote.spec.ts`
- Create: `platform/shell/host/public/e2e/remote-registry.json`
- Modify: `package.json` (add `@playwright/test` `1.64.1`)
- Modify: `platform/shell/host/project.json` (ensure e2e configuration file replacement and `public/` assets)

**Interfaces:**
- Consumes: Nx serve targets for `identity-card` (4301) and `shell-host` (4200, `e2e` configuration); `environment.e2e.ts` (`registryUrl: '/e2e/remote-registry.json'`).
- Produces: `shell-host-e2e` project with target `e2e` (`nx:run-commands` → `playwright test --config=platform/shell/host-e2e/playwright.config.ts`).

- [ ] **Step 1: Write the failing test**

```ts
test('the shell renders a card loaded from the runtime registry', async ({ page }) => {
  await page.goto('/');
  const card = page.getByTestId('project-card-identity');
  await expect(card).toContainText('Identity');
  await expect(card).toContainText('GitHub sign-in');
  await expect(page.getByTestId('remote-card-identity')).toBeVisible(); // remote code, not the fallback
});
```

`playwright.config.ts`: `testDir: './src'`, `baseURL: 'http://localhost:4200'`, two `webServer` entries (`npx nx serve identity-card --port 4301`, url `http://localhost:4301/remoteEntry.js`; `npx nx serve shell-host --port 4200 --configuration=e2e`, url `http://localhost:4200`), `reuseExistingServer: !process.env.CI`, 180s timeouts, `reporter: 'list'`, chromium only.

`public/e2e/remote-registry.json`: one `identity` project pointing at `http://localhost:4301/remoteEntry.js`.

- [ ] **Step 2: Run to verify failure**

Run: `npx nx e2e shell-host-e2e`
Expected: FAIL — project target/test missing.

- [ ] **Step 3: Add the project, config, test, and dependency; wire the `e2e` file replacement**

- [ ] **Step 4: Install the browser once and run to verify pass**

Run: `npx playwright install chromium`, then `npx nx e2e shell-host-e2e`
Expected: PASS (1 test). If the fallback card appears instead, the remote did not load — fix the MF config, do not weaken the assertion.

- [ ] **Step 5: Commit**

```bash
git add platform/shell/host-e2e platform/shell/host/public package.json package-lock.json platform/shell/host/project.json
git commit -m "test: add dynamic remote loading browser e2e"
```

---

## Task 17: CI and branch-protection updates

**Files:**
- Modify: `.github/workflows/platform-ci.yml`
- Modify: `tools/validate-workflows.spec.ts`
- Modify: `.github/workflows/apply-branch-protection.yml`
- Modify: `platform/harness/ACTIVATION.md`

**Interfaces:**
- Consumes: Nx targets from Tasks 12–16; `platform:shell` Gradle module (already covered by `./gradlew build`).
- Produces: jobs `frontend-build` (`npm ci`; `npx nx run-many -t lint test --projects=shared-ui-lib,shell-host,identity-card`; `npx nx build shell-host`; `npx nx build identity-card`) and `shell-e2e` (`npm ci`, `npx playwright install --with-deps chromium`, `npx nx e2e shell-host-e2e`); both added to the required-check list.

- [ ] **Step 1: Extend the failing workflow tests**

```ts
it('platform-ci.yml runs the frontend build and the shell e2e', () => {
  const doc: any = yaml.load(fs.readFileSync('.github/workflows/platform-ci.yml', 'utf8'));
  expect(doc.jobs['frontend-build']).toBeDefined();
  expect(doc.jobs['shell-e2e']).toBeDefined();
  expect(doc.jobs['shell-e2e'].steps.map((s: any) => s.run)).toEqual(
    expect.arrayContaining([expect.stringContaining('playwright install')]),
  );
});

it('branch protection requires the new checks', () => {
  const raw = fs.readFileSync('.github/workflows/apply-branch-protection.yml', 'utf8');
  expect(raw).toContain("'frontend-build'");
  expect(raw).toContain("'shell-e2e'");
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest tools/validate-workflows.spec.ts`
Expected: FAIL — jobs/checks missing.

- [ ] **Step 3: Add the jobs and register the checks**

`platform-ci.yml`: keep `platform-build`; add `frontend-build` and `shell-e2e` on `ubuntu-latest` with Node 24, `npm ci`, then the commands above. `apply-branch-protection.yml`: append `'frontend-build'` and `'shell-e2e'` to the `buildMainBranchRuleset([...])` list. `ACTIVATION.md`: note the ruleset must be refreshed manually (POST is not idempotent) and the check names verified against what GitHub reports.

- [ ] **Step 4: Run to verify pass**

Run: `npx jest tools/validate-workflows.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows platform/harness/ACTIVATION.md tools/validate-workflows.spec.ts
git commit -m "ci: add frontend build and shell e2e checks"
```

---

## Self-Review Notes

- **Spec coverage:** Shell/Gateway — Spring Cloud Gateway (Task 1, 7), Angular host + MF card grid (Tasks 12–14), no business logic (Task 3 is one read-only claims endpoint), dynamic registry with CD-updatable file (Tasks 4, 5), CSP/trusted origins and remotes never receiving the token (Tasks 6, 9, 14). Microfrontend sharing foundation — opt-in exposed `card` module (Task 15), registry lookup by project+module+version and shared singletons (Tasks 12, 13, 15). Personas/Auth — shared login screen + callback consuming Plan 2's `/auth/login` and `POST /api/token` (Tasks 8–11), fragment-free redirects (Task 8), denial UX (Tasks 10, 11), shell as resource server (Tasks 2, 3). Environments — dev is local Gradle/Nx; packaging/Compose explicitly deferred to Plan 5.
- **Step scan:** every step is one artifact — a named test with assertions, a class/record signature, a command with expected output, or a commit. Bodies appear only where the tests do not determine the algorithm (origin normalization, project drop rules, redirect composition).
- **Type consistency:** `RemoteProject`/`ExposedModule` are defined once (Task 4) and serialized unchanged by Task 5; the SPA `RemoteProject` mirrors those field names (Task 13); `RemoteModuleEntry` (Plan 1) is constructed with `projectId` added (Task 13) and consumed by `RemoteRegistryService.resolveModule` (Plan 1, unchanged); `RemoteCardComponent` inputs match `CardComponent`'s (Task 14) and the fixture implements them (Task 15); the token contract types (Task 9) match `TokenController.TokenResponse` exactly (`accessToken`, `tokenType`, `expiresIn`, `principal{id, login, email, displayName, role}`); `permit-paths` includes the routes Tasks 5/7/11 serve.
- **Review Focus:** all seven pinned — untrusted origin drop (Tasks 4, 6), malformed registry 503 + SPA error (Tasks 4, 5, 14), remote failure fallback (Task 14), hot reload (Task 4), denial/missing/replayed code (Tasks 9, 10, 11), fragment removal (Tasks 8, 11), open redirect + bearer scoping (Tasks 8, 9).
- **Version verification:** Angular latest stable `22.2.3` (angular.dev, 2026-10-14) but the workspace pins `~22.1.0`; the plan uses the workspace version and pins `@angular-architects/module-federation@22.0.0` (npm, Angular 22 support). Spring Cloud `2025.1.3` is the latest stable train (Gateway `5.0.3`, docs.spring.io); it certifies Boot 4.0.x, so the Boot 4.1.1 combination is an explicit verify-at-implementation risk with an escalation rule, not a silent downgrade. Playwright `1.64.1` verified on npm.
- **Proportion:** the plan implements the spec's shell section plus the three Plan 2 handoffs; it defers TinyURL (Plan 4), infra packaging (Plan 5), and admin triage (Plan 6), matching Plan 2's one-test-cycle-per-task granularity rather than transcribing implementation bodies.
- **Residual risk (explicit):** the access token lives in `sessionStorage`, which is same-origin-readable. Spec accepts this origin model with CSP-pinned remotes and defers iframe isolation; if a future remote is untrusted, move the token behind a gateway session or sandbox that remote. No browser login E2E exists (fake provider not built); denial is covered by Task 10's identity test plus Task 11's SPA callback test, and the dynamic-loading E2E is Task 16.

## Dispatch Ledger

Routing per AGENTS.md. Limitation: providers expose no token/cost data — rows record dispatch counts and outcomes, never fabricated costs.

| Task | Phase | Shape | Model | Why | Outcome (tests/build) | Retries/escalation |
|---|---|---|---|---|---|---|
| plan | 3 Plan | High (architecture plan; cross-cutting shell/auth/MF/security) | `opencode-go/deepseek-v4.1-flash#high` | AGENTS.md Phase 3 primary | Plan file written; planning only — no build/tests run | 2 transient dispatch failures (region restriction, then interrupt) → succeeded on retry; provider exposes no token/cost data |
| 1 | 5 Build | Low (scaffold transcription + boot test) | `opencode-go/glm-5.3-flash` (session, inline) | AGENTS.md Phase 5 primary; executing-plans inline | BUILD SUCCESSFUL, 1/1 | 0 |
| 2 | 5 Build | Medium (starter chain extension, TDD) | `opencode-go/glm-5.3-flash` (session, inline) | security-adjacent chain change | starter+identity suites green | Requires Boot 4 correction (Ruling in ledger) — plan assumed Boot 3 module paths | 1 (module-path ruling, not a logic loop) |
| 3 | 5 Build | Low (controller + yaml transcription) | `opencode-go/glm-5.3-flash` (session, inline) | simple endpoint | 2/2 | 0 |
| 4 | 5 Build | Medium (validation rules + hot reload) | `opencode-go/glm-5.3-flash` (session, inline) | domain validation; npe from unset config caught by suite | shell suite green | 1 fix commit (bean registration + null tolerance) |
| 5 | 5 Build | Low (endpoint + docs) | `opencode-go/glm-5.3-flash` (session, inline) | mostly transcription | shell suite green | 0 |
| 6 | 5 Build | Medium (CSP policy + filter) | `opencode-go/glm-5.3-flash` (session, inline) | security header emission | shell suite green | 1 test-fixture fix (registry file path in tests) |
| 7 | 5 Build | High (gateway routes + SPA fallback integration) | `opencode-go/glm-5.3-flash` (session, inline) | integration wiring; yaml nesting bug (self-inflicted, caught by suite) | 4/4 after fix | 1 diagnostic loop (yaml structure) — would have been faster with careful single-write; RestClient vs RestTemplate DSL correction |
| 8 | 5 Build | Medium (pure helpers + zoneless Angular tests) | `opencode-go/glm-5.3-flash` (session, inline) | TDD helpers + jest TestBed provider ordering + Boot-4-era jsdom quirks | shared-ui-lib suites green | 2 code fixes (type-only InjectionToken import; clear() during field init), 1 spec restructure |
| 9 | 5 Build | Medium (token store, exchange, interceptor) | `opencode-go/glm-5.3-flash` (session, inline) | auth contract touchpoints | shared-ui-lib suites green | 1 fix commit (strict typing + generator churn) |
| 10 | 5 Build | Low (failure handler + SecurityConfig swap) | `opencode-go/glm-5.3-flash` (session, inline) | small security handler | identity suite green | 0 |
| 11 | 5 Build | Medium (login/callback components, provideAuth) | `opencode-go/glm-5.3-flash` (session, inline) | component contracts consumed by host | shared-ui-lib suites green | 0 |
| 12 | 5 Build | Medium (host scaffold + MF wiring) | `opencode-go/glm-5.3-flash` (session, inline) | generator scaffolding + config edits | shell-host tests + build green | 0 |
| 13 | 5 Build | Medium (registry client + federated loader) | `opencode-go/glm-5.3-flash` (session, inline) | loader + provider wiring | shell-host suites green | 0 |
| 14 | 5 Build | Medium (card grid, remote host, fallback) | `opencode-go/glm-5.3-flash` (session, inline) | component + fallback paths | shell-host suites green | 0 (defect surfaced later in Task 16: duplicate applyMetadata masked by jest transpile-only — fixed d45ad78) |
| 15 | 5 Build | Medium (fixture remote + manifest) | `opencode-go/glm-5.3-flash` (session, inline) | MF remote config + fixture | identity-card tests + remote build green | 1 ruling (webpack 5.109.2 pin) |
| 16 | 5 Build | High (browser e2e + MF runtime debugging) | `opencode-go/glm-5.3-flash` (session, inline) | integration debugging (NG0201 wiring gap; ESM-vs-classic remoteEntry; duplicate testids) | e2e 1/1 pass | 3 findings, each RED->GREEN; escalated logic to systematic-debugging, no model escalation needed |
| 17 | 5 Build | Low (CI jobs + branch protection) | `opencode-go/glm-5.3-flash` (session, inline) | workflow yaml + spec transcription | validate-workflows 12/12 | 0 |
| 6 Review | 6 Review (deep) | High (security-sensitive shell/auth/MF) | `opencode-go/glm-5.3` (explicit deep-review override) | AGENTS.md deep review for High-shape | 2 Critical, 2 Important, 10 Minor; With fixes | fix pass 2f98f95: all gates green after |
