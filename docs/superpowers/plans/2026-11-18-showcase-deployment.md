# Showcase Deployment via Cloudflare Quick Tunnel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the never-built Oracle/k3s production path with a one-command local Docker Compose stack published through a free Cloudflare Quick Tunnel, serving the shell and every project microfrontend from a single origin with no hostname baked into any artifact.

**Architecture:** The shell Spring Boot jar becomes the only public origin: it serves the shell SPA and each app build under `/apps/<id>/`, proxies per-app APIs with `StripPrefix`, and derives absolute URLs from the request. Registry entries become root-relative, so a new tunnel hostname needs no rebuild. A flag-gated demo-login controller in Identity mints a real one-time code, and a seeder fills TinyURL with demo data. k3s manifests, arm64 image builds and the deploy workflow are deleted; CI proves the compose stack instead.

**Tech Stack:** Java 17, Spring Boot 3 / Spring Cloud Gateway MVC, Angular 22 + Nx 24, Module Federation (classic `var` library), PostgreSQL 18, Docker Compose, `cloudflare/cloudflared`, Playwright, Jest, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-18-showcase-deployment-design.md`

## Roadmap Position

Plans 1–4 (harness foundations, identity, shell/gateway, TinyURL) are complete and merged; this plan
does not reopen, renumber or rewrite any of them. There is no single "main plan" file: the roadmap
lives in the specs, and each numbered plan is one increment.

- **Plan 5 (cluster/infra) was never written.** This document *is* Plan 5's replacement — not a
  sub-plan of an existing plan, and not a fork of completed work. The Oracle/k3s intent it replaces
  existed only as prose in the two specs.
- **Plan 6 (admin-triage) remains open and unchanged**, and starts after this plan merges. Nothing
  in this plan claims its scope.
- **A future real-hosting plan** (VPS or cloud plus a domain) is a new plan written when you are
  ready to pay for or own that infrastructure. The Oracle path is retired, not deferred.
- The platform spec's phase-1 goal ("adding a second app is not a rebuild") is preserved: this plan
  keeps multi-app hosting under `/apps/<id>/`, even though only TinyURL ships today.

## Global Constraints

- Work on a feature branch (`feat/showcase-cloudflare-tunnel`); never commit on `main` (repository rules reject it).
- Windows/PowerShell first: `.\gradlew.bat` locally, `./gradlew` in CI. Node 24, JDK 17, `npm ci` only.
- Conventional commit messages; prettier must pass on `platform/**/*.{ts,html}`, `tools/**/*.ts`, `eslint.config.mjs`, `jest.config.ts`, `jest.preset.js`.
- No hostname may be baked into a shipped artifact: the only allowed URL literals in production bundles are root-relative paths. `localhost:8081` must not appear in any dist.
- The demo login and seeder are inert unless their properties are `true`; the default configuration must keep them off.
- The registry file is explicitly in AGENTS.md's "do not touch" list; changing it to relative URLs is a deliberate, user-approved deviation recorded as a `Ruling:` in `retrospectives.md` (Task 14).
- The existing specs are "read-only records"; amending them in place is a deliberate, user-approved deviation, also recorded as a `Ruling:`.
- Keep the identity issuer / JWKS URLs on the internal service address (`http://identity:8081`); they are never browser-visible.

## Review Focus

- **Proxied absolute URLs:** a short link generated behind the tunnel must be `https://<public-host>/go/<slug>`, never `http://` or the container host. Tested in Task 6.
- **Relative registry entries:** an app entry with a `/apps/...` URL must not be silently dropped by validation, and a genuinely untrusted absolute URL still must be. Tested in Task 1.
- **Deep links under an app prefix:** refreshing `/apps/tinyurl/browse/whatever` must serve the app shell, while a missing `.js` file must still 404. Tested in Task 2.
- **Inert demo:** with the demo flag off, `/api/demo-login` must not mint a token. Tested in Task 4.
- **Token scope:** the interceptor must attach the JWT to configured same-origin API prefixes only, never to absolute/cross-origin URLs; `sessionStorage` means a shell-tab sign-in does not carry into the app tab, which is why sign-in lives inside the app. Tested in Task 7.

## File Structure

**Created**

- `platform/shell/src/main/java/com/supportfolio/platform/shell/web/AppHostingConfig.java` — resource handler + SPA fallback for `/apps/**`.
- `platform/shell/src/main/java/com/supportfolio/platform/shell/web/FeaturesController.java` — `/api/features`.
- `platform/shell/src/test/java/com/supportfolio/platform/shell/web/AppHostingTest.java`
- `platform/shell/src/test/java/com/supportfolio/platform/shell/web/FeaturesControllerTest.java`
- `platform/shell/src/test/resources/static/apps/tinyurl/{index.html,main.js}` — fixtures.
- `platform/identity/src/main/java/com/supportfolio/platform/identity/demo/DemoLoginController.java`
- `platform/identity/src/test/java/com/supportfolio/platform/identity/demo/DemoLoginControllerTest.java`
- `projects/tinyurl/service/src/main/java/com/supportfolio/tinyurl/demo/DemoDataSeeder.java`
- `projects/tinyurl/service/src/test/java/com/supportfolio/tinyurl/demo/DemoDataSeederTest.java`
- `platform/shell/Dockerfile`, `platform/identity/Dockerfile`
- `docker-compose.demo.yml`, `scripts/demo.ps1`
- `projects/tinyurl/ci/demo-login.spec.ts`, `projects/tinyurl/ci/playwright.demo.config.ts`
- `docs/superpowers/plans/2026-11-18-showcase-deployment.md` (this file)

**Modified**

- `platform/shell/src/main/java/.../registry/RemoteRegistry.java`, `.../web/SpaForwardController.java`, `platform/shell/src/main/resources/application.yaml`, `platform/shell/config/remote-registry.json`, `platform/shell/build.gradle.kts`, `platform/shell/host/src/app/app.config.ts`.
- `platform/identity/.../login/SecurityConfig.java`, `platform/identity/build.gradle.kts`.
- `projects/tinyurl/service/.../link/{LinkController,LinkView}.java`, `projects/tinyurl/service/src/main/resources/application.yaml`, `projects/tinyurl/service/build.gradle.kts` (already pinned).
- `projects/tinyurl/microfrontend/src/app/{app.config.ts,links/link.types.ts,links/link-api.service.ts,links/link-api-base-url.ts,environment*.ts}`, browse/shorten components, `project.json`, `webpack.config.js`.
- `platform/shared-ui-lib/src/lib/auth/{auth.types.ts,provide-auth.ts,auth.interceptor.ts,login-page.component.ts,login-page.component.html}` + specs.
- `.github/workflows/tinyurl-ci.yml`, `.github/workflows/platform-ci.yml`, `platform/harness/ACTIVATION.md`.
- `tools/{validate-workflows.spec.ts,validate-tinyurl-docs.spec.ts,branch-protection.ts,branch-protection.spec.ts,prod-bundle-gate.ts,prod-bundle-gate.spec.ts,sync-harness-workflows.ts}`; delete `tools/validate-tinyurl-deploy.spec.ts`.
- `docs/superpowers/specs/{2026-10-16-portfolio-platform-design.md,2026-10-20-tinyurl-design.md}`, `docs/superpowers/retrospectives.md`, `AGENTS.md`, `projects/tinyurl/README.md`, `platform/shell/README.md`.

**Deleted**

- `projects/tinyurl/deploy/` (7 files), `projects/tinyurl/ci/trivy.yaml`,
  `projects/tinyurl/ci/docker-compose.prod-e2e.yml`, `projects/tinyurl/ci/stub-identity/`,
  `projects/tinyurl/ci/prod-login.spec.ts`, `projects/tinyurl/ci/playwright.prod.config.ts`,
  `.github/workflows/deploy.yml`, `platform/harness/workflows/deploy.yml`.

---

### Task 1: Accept same-origin root-relative URLs in the registry

**Files:**
- Modify: `platform/shell/src/main/java/com/supportfolio/platform/shell/registry/RemoteRegistry.java:87-119`
- Test: `platform/shell/src/test/java/com/supportfolio/platform/shell/registry/RemoteRegistryTest.java`
- Modify: `platform/shell/config/remote-registry.json`

**Interfaces:**
- Consumes: nothing new.
- Produces: `RemoteRegistry.projects()` unchanged; validation accepts a value that starts with a single `/` as same-origin, for `openUrl` and each `ExposedModule.remoteEntry`.

- [ ] **Step 1: Write the failing tests**

Add to `RemoteRegistryTest` (reuse its existing fixture-writing helper; add a private `writeRegistry(String json)` helper if the class does not already have one):

```java
@Test
void acceptsRootRelativeOpenUrlAndRemoteEntry() {
  writeRegistry("""
      {"projects":[{"id":"tinyurl","displayName":"TinyURL","shortDescription":"d",
      "features":["f"],"openUrl":"/apps/tinyurl/",
      "exposedModules":[{"name":"card","version":"1.0.0",
      "remoteEntry":"/apps/tinyurl/remoteEntry.js"}]}]}
      """);
  assertThat(registry.projects()).hasSize(1);
}

@Test
void rejectsProtocolRelativeAndUntrustedAbsoluteEntries() {
  writeRegistry("""
      {"projects":[{"id":"tinyurl","displayName":"TinyURL","shortDescription":"d",
      "features":["f"],"openUrl":"//evil.example/x",
      "exposedModules":[{"name":"card","version":"1.0.0",
      "remoteEntry":"http://evil.example/remoteEntry.js"}]}]}
      """);
  assertThat(registry.projects()).isEmpty();
}
```

- [ ] **Step 2: Run to verify failure**

Run: `.\gradlew.bat :platform:shell:test --tests "*RemoteRegistryTest"`
Expected: FAIL — relative entries are dropped (`accepts...` sees an empty list).

- [ ] **Step 3: Implement `allowedEntryUrl`**

Replace the two `isHttpUrl(...)` checks with a helper that accepts either a trusted absolute http(s) URL (existing origin check) or a root-relative path:

```java
private boolean allowedEntryUrl(String url) {
  return url != null && (isHttpUrl(url) && trustedOrigins.contains(originOf(url)))
      || isRootRelative(url);
}

private boolean isRootRelative(String url) {
  return url != null && url.startsWith("/") && !url.startsWith("//") && url.indexOf(':') < 0;
}
```

Keep the module-origin check for absolute URLs only.

- [ ] **Step 4: Point the committed registry at the demo paths**

`platform/shell/config/remote-registry.json`: `openUrl` → `/apps/tinyurl/`, `remoteEntry` → `/apps/tinyurl/remoteEntry.js`. Keep `displayName`, `shortDescription`, `features`, `version` unchanged.

- [ ] **Step 5: Run tests and commit**

Run: `.\gradlew.bat :platform:shell:test --tests "*RemoteRegistryTest"`
Expected: PASS.

```bash
git add platform/shell/src/main/java platform/shell/src/test platform/shell/config/remote-registry.json
git commit -m "feat(shell): accept same-origin registry entries"
```

---

### Task 2: Serve app builds under `/apps/<id>/`

**Files:**
- Create: `platform/shell/src/main/java/.../web/AppHostingConfig.java`
- Modify: `platform/shell/src/main/java/.../web/SpaForwardController.java`
- Modify: `platform/shell/src/main/resources/application.yaml` (permit paths + static locations)
- Create: `platform/shell/src/test/java/.../web/AppHostingTest.java`
- Create: `platform/shell/src/test/resources/static/apps/tinyurl/index.html` (body: `tinyurl-index`), `.../main.js` (body: `console.log('tinyurl')`)
- Create: `platform/shell/src/main/resources/static/robots.txt` (`User-agent: *` / `Disallow: /`)

**Interfaces:**
- Produces: `GET /apps/{id}` → `302 /apps/{id}/`; `/apps/{id}/**` serves static resources; extension-less missing paths fall back to `/apps/{id}/index.html`.

- [ ] **Step 1: Write the failing test**

```java
@SpringBootTest
@AutoConfigureMockMvc
class AppHostingTest {
  @Autowired MockMvc mvc;

  @Test void servesIndexWithTrailingSlash() throws Exception {
    mvc.perform(get("/apps/tinyurl/")).andExpect(status().isOk())
        .andExpect(content().string(containsString("tinyurl-index")));
  }
  @Test void redirectsMissingTrailingSlash() throws Exception {
    mvc.perform(get("/apps/tinyurl")).andExpect(status().is3xxRedirection())
        .andExpect(header().string("Location", "/apps/tinyurl/"));
  }
  @Test void servesDeepLinksFromIndex() throws Exception {
    mvc.perform(get("/apps/tinyurl/browse/anything")).andExpect(status().isOk())
        .andExpect(content().string(containsString("tinyurl-index")));
  }
  @Test void missingAssetStays404() throws Exception {
    mvc.perform(get("/apps/tinyurl/missing.js")).andExpect(status().isNotFound());
  }
}
```

- [ ] **Step 2: Run to verify failure**

Run: `.\gradlew.bat :platform:shell:test --tests "*AppHostingTest"`
Expected: FAIL — 401/404, no static handling.

- [ ] **Step 3: Implement the resource handler and redirect**

`AppHostingConfig` implements `WebMvcConfigurer#addResourceHandlers` for `/apps/**`, location `classpath:/static/apps/`, `file:/app/static/apps/`, `file:dist/`-free; use a `PathResourceResolver` subclass whose `getResource` returns the requested resource if it exists, else — when the path has no `.` — `apps/<id>/index.html`. Add to `SpaForwardController`:

```java
@GetMapping("/apps/{id}")
String appRoot(@PathVariable String id) { return "redirect:/apps/" + id + "/"; }
```

Add to `supportfolio.security.permit-paths`: `/apps/**`, and set
`spring.web.resources.static-locations: classpath:/static/,file:/app/static/`. The handler's own
locations are `classpath:/static/apps/` and `file:/app/static/apps/`.

Also register a small `OncePerRequestFilter` that sets `X-Robots-Tag: noindex` when
`supportfolio.shell.noindex` is true (default true), and add `robots.txt` under the shell's static
resources. Add a test asserting `/robots.txt` is served anonymously and the header is present.

- [ ] **Step 4: Run test and commit**

Run: `.\gradlew.bat :platform:shell:test --tests "*AppHostingTest"`
Expected: PASS.

```bash
git add platform/shell/src
git commit -m "feat(shell): host project builds under /apps"
```

---

### Task 3: Gateway routes, demo-login route, features endpoint

**Files:**
- Modify: `platform/shell/src/main/resources/application.yaml`
- Create: `platform/shell/src/main/java/.../web/FeaturesController.java`
- Create: `platform/shell/src/test/java/.../web/FeaturesControllerTest.java`
- Modify: `platform/shell/src/test/java/.../web/GatewayRoutingTest.java`

**Interfaces:**
- Produces: `GET /api/features` → `{"demoLogin": <supportfolio.shell.demo-login-enabled>}`; gateway routes `/apps/*/api/**` (StripPrefix=2) and `/go/**` to `${supportfolio.shell.tinyurl-uri}`; `/api/demo-login` to identity.

- [ ] **Step 1: Write the failing tests**

```java
@SpringBootTest(properties = "supportfolio.shell.demo-login-enabled=true")
@AutoConfigureMockMvc
class FeaturesControllerTest {
  @Autowired MockMvc mvc;
  @Test void reportsDemoLogin() throws Exception {
    mvc.perform(get("/api/features")).andExpect(status().isOk())
        .andExpect(jsonPath("$.demoLogin").value(true));
  }
}
```

In `GatewayRoutingTest`, add a case asserting a request to `/apps/tinyurl/api/links` reaches the stub with path `/api/links`, and one asserting `/go/abc` reaches the stub at `/go/abc`.

- [ ] **Step 2: Run to verify failure**

Run: `.\gradlew.bat :platform:shell:test --tests "*FeaturesControllerTest" --tests "*GatewayRoutingTest"`
Expected: FAIL — 404 on `/api/features`; no route for `/apps/**` or `/go/**`.

- [ ] **Step 3: Implement routes and controller**

```java
@RestController
class FeaturesController {
  FeaturesController(@Value("${supportfolio.shell.demo-login-enabled:false}") boolean demoLogin)
  @GetMapping("/api/features") Map<String, Object> features() { return Map.of("demoLogin", demoLogin); }
}
```

Routes: add `app-api` (`Path=/apps/*/api/**`, `StripPrefix=2`), `tinyurl-redirect` (`Path=/go/**`), `identity-demo-login` (`Path=/api/demo-login`). Add `permit-paths` entries `/go/**`, `/api/features`, `/api/demo-login`; add `csrf-ignore-paths` entries `/api/demo-login`, `/apps/*/api/**`. Add property `supportfolio.shell.tinyurl-uri` defaulting to `http://localhost:8082`.

- [ ] **Step 4: Run tests and commit**

Run: `.\gradlew.bat :platform:shell:test`
Expected: PASS.

```bash
git add platform/shell/src platform/shell/config
git commit -m "feat(shell): route app APIs, redirects and demo login"
```

---

### Task 4: Flag-gated demo login in Identity

**Files:**
- Create: `platform/identity/src/main/java/.../demo/DemoLoginController.java`
- Create: `platform/identity/src/test/java/.../demo/DemoLoginControllerTest.java`
- Modify: `platform/identity/src/main/java/.../login/SecurityConfig.java:34-57`

**Interfaces:**
- Consumes: `OneTimeCodeStore.create(InternalPrincipal)`, `InternalPrincipal.of(ExternalIdentity, IdentityRole)`.
- Produces: `POST /api/demo-login` → `{"code":"<43 chars>"}` when `supportfolio.identity.demo-enabled=true`; absent otherwise.

- [ ] **Step 1: Write the failing tests**

Two contexts: enabled → 200 + consumable code with role ADMIN; disabled → no 200.

```java
@SpringBootTest(properties = "supportfolio.identity.demo-enabled=true")
@AutoConfigureMockMvc
class DemoLoginControllerTest {
  @Autowired MockMvc mvc;
  @Autowired OneTimeCodeStore codes;

  @Test void mintsConsumableAdminCode() throws Exception {
    String body = mvc.perform(post("/api/demo-login")).andExpect(status().isOk())
        .andReturn().getResponse().getContentAsString();
    String code = JsonPath.read(body, "$.code");
    assertThat(codes.consume(code)).hasValueSatisfying(p ->
        assertThat(p.role()).isEqualTo(IdentityRole.ADMIN));
  }
}
```

Add a second test class with `demo-enabled` absent asserting the request is not 200.

- [ ] **Step 2: Run to verify failure**

Run: `.\gradlew.bat :platform:identity:test --tests "*DemoLoginControllerTest"`
Expected: FAIL — 401/404, no endpoint.

- [ ] **Step 3: Implement controller and security entries**

```java
@RestController
@ConditionalOnProperty(name = "supportfolio.identity.demo-enabled", havingValue = "true")
class DemoLoginController {
  DemoLoginController(OneTimeCodeStore codes)
  @PostMapping("/api/demo-login") Map<String, String> login()
}
```

Principal: `InternalPrincipal.of(new ExternalIdentity("demo", "demo", "demo@example.invalid", "Demo Reviewer"), IdentityRole.ADMIN)`.
Add `/api/demo-login` to `permitAll` matchers and to `csrf().ignoringRequestMatchers(...)`.

- [ ] **Step 4: Run tests and commit**

Run: `.\gradlew.bat :platform:identity:test`
Expected: PASS (existing identity tests unaffected).

```bash
git add platform/identity/src
git commit -m "feat(identity): add flag-gated demo login"
```

---

### Task 5: Server-built absolute short URLs

**Files:**
- Modify: `projects/tinyurl/service/src/main/java/.../link/LinkView.java`
- Modify: `projects/tinyurl/service/src/main/java/.../link/LinkController.java`
- Modify: `projects/tinyurl/service/src/main/resources/application.yaml`
- Test: `projects/tinyurl/service/src/test/java/.../link/{LinkBrowseTest,LinkCreationTest}.java`

**Interfaces:**
- Produces: `LinkView(String slug, String targetUrl, String shortUrl, long clickCount, Instant createdAt)`; `shortUrl` absolute, derived from the current request.

- [ ] **Step 1: Write the failing tests**

In `LinkBrowseTest`, assert every row has an absolute `shortUrl`:
`jsonPath("$.links[0].shortUrl", startsWith("http://localhost"))` and `endsWith("/go/"+slug)`.
Add a forwarded-header case:

```java
mvc.perform(get("/api/links").header("X-Forwarded-Proto", "https")
        .header("X-Forwarded-Host", "demo.example"))
    .andExpect(jsonPath("$.links[0].shortUrl", startsWith("https://demo.example/go/")));
```

- [ ] **Step 2: Run to verify failure**

Run: `.\gradlew.bat :projects:tinyurl:service:test --tests "*LinkBrowseTest"`
Expected: FAIL — no `shortUrl` field.

- [ ] **Step 3: Implement in the controller, not the service**

Keep `LinkService` request-free. Add the field to the record and have `LinkService` construct views
with an empty `shortUrl`; the controller rewrites each one:

```java
private LinkView withShortUrl(LinkView v) {
  return new LinkView(v.slug(), v.targetUrl(),
      ServletUriComponentsBuilder.fromCurrentContextPath().path("/go/{slug}").buildAndExpand(v.slug()).toUriString(),
      v.clickCount(), v.createdAt());
}
```

Add `server.forward-headers-strategy: framework` to the service's `application.yaml` (the shell and gateway already forward `X-Forwarded-*`).

- [ ] **Step 4: Run tests and commit**

Run: `.\gradlew.bat :projects:tinyurl:service:test`
Expected: PASS.

```bash
git add projects/tinyurl/service/src
git commit -m "feat(tinyurl): return absolute short URLs"
```

---

### Task 6: Shared auth — scoped token prefixes and the demo button

**Files:**
- Modify: `platform/shared-ui-lib/src/lib/auth/{auth.types.ts,provide-auth.ts,auth.interceptor.ts,login-page.component.ts,login-page.component.html}`
- Test: `platform/shared-ui-lib/src/lib/auth/{auth.interceptor.spec.ts,login-page.component.spec.ts,provide-auth.spec.ts}`

**Interfaces:**
- Produces: `AuthConfig.apiUrlPrefixes: string[]` (default `['/api/']`); `LoginPageComponent` renders `data-testid="demo-sign-in"` only when `GET /api/features` returns `{demoLogin:true}`; clicking POSTs `/api/demo-login` and navigates to `/auth/callback?code=…`.
- Consumes: Task 3's `/api/features`, Task 4's `/api/demo-login`.

- [ ] **Step 1: Write the failing specs**

Interceptor: with `apiUrlPrefixes: ['/apps/tinyurl/api/']` and a token, `'/apps/tinyurl/api/links'` gets the header; `'/api/links'` does not; `'http://evil.example/apps/tinyurl/api/links'` does not.
Login page: when the features call returns `{demoLogin:true}`, the button exists; clicking it POSTs `/api/demo-login` and navigates to `/auth/callback` with the returned `code`.

- [ ] **Step 2: Run to verify failure**

Run: `npx nx test shared-ui-lib --testPathPattern="auth.interceptor|login-page"`
Expected: FAIL.

- [ ] **Step 3: Implement**

- `AuthConfig` gains `apiUrlPrefixes: string[]`; `provideAuth` defaults it to `['/api/']`.
- Interceptor: token present, `!req.url.includes('://')`, `!req.url.startsWith('/api/token')`, and `config.apiUrlPrefixes.some(p => req.url.startsWith(p))`.
- `LoginPageComponent`: `http = inject(HttpClient)`, `router = inject(Router)`, `demoAvailable = signal(false)`; in `ngOnInit` `http.get<{demoLogin:boolean}>('/api/features').subscribe(...)` with `error → false`; `demoLogin()` posts then `router.navigate(['/auth/callback'], { queryParams: { code } })`.
- Template adds the demo button next to `sign-in` and keeps existing testids.

- [ ] **Step 4: Run specs and the shell build**

Run: `npx nx test shared-ui-lib && npx nx build shell-host`
Expected: PASS. (Both bundles are checked for leaked dev URLs in Task 8, after the shell config stops hardcoding `localhost:8081`.)

- [ ] **Step 5: Commit**

```bash
git add platform/shared-ui-lib
git commit -m "feat(ui): scope auth token and add demo sign-in"
```

---

### Task 7: TinyURL frontend uses the server URL and app-relative paths

**Files:**
- Modify: `projects/tinyurl/microfrontend/src/app/links/link.types.ts`, `link-api.service.ts` (+ spec)
- Create: `projects/tinyurl/microfrontend/src/app/links/link-api-base-url.ts`
- Delete: `projects/tinyurl/microfrontend/src/app/links/short-link-base-url.ts`
- Modify: `projects/tinyurl/microfrontend/src/app/{app.config.ts,browse/browse-page.component.*,shorten/shorten-form.component.*}`
- Modify: `projects/tinyurl/microfrontend/src/environments/{environment.ts,environment.prod.ts,environment.prod.spec.ts}`
- Modify: `projects/tinyurl/microfrontend/project.json`, `webpack.config.js`

**Interfaces:**
- Produces: `LINK_API_BASE_URL` token (default `''`), `Link { slug; targetUrl; shortUrl; clickCount; createdAt }`, `environment.linkApiBaseUrl`, `environment.callbackPath`, `environment.apiUrlPrefixes` (dev `['/api/']`, prod `['/apps/tinyurl/api/']`).
- Consumes: Task 5's `shortUrl`; Task 6's `AuthConfig.apiUrlPrefixes`.

- [ ] **Step 1: Write the failing specs**

`link-api.service.spec.ts`: with `LINK_API_BASE_URL='/apps/tinyurl'`, `list()` GETs `/apps/tinyurl/api/links`; `create()` POSTs the same path; no `shortUrl()` method remains. `environment.prod.spec.ts`: asserts `linkApiBaseUrl === '/apps/tinyurl'`, `callbackPath === '/apps/tinyurl/auth/callback'`, `apiUrlPrefixes` deep-equals `['/apps/tinyurl/api/']`, `apiBaseUrl === ''`, and no value contains `localhost`.

- [ ] **Step 2: Run to verify failure**

Run: `npx nx test tinyurl-microfrontend --testPathPattern="link-api|environment.prod"`
Expected: FAIL.

- [ ] **Step 3: Implement**

- New token file mirrors the deleted one:

```ts
export const LINK_API_BASE_URL = new InjectionToken<string>('LINK_API_BASE_URL', { factory: () => '' });
```
- Service builds `${base}/api/links`, deletes `shortUrl(slug)`.
- `app.config.ts` provides `LINK_API_BASE_URL` from `environment.linkApiBaseUrl`, passes
  `apiUrlPrefixes: environment.apiUrlPrefixes`, and `callbackPath: environment.callbackPath` to
  `provideAuth` (keep `apiBaseUrl: ''` — that field is the token endpoint).
- Templates render `link.shortUrl`.
- Environments: dev `linkApiBaseUrl: ''`, `callbackPath: '/auth/callback'`, `apiUrlPrefixes: ['/api/']`; prod `linkApiBaseUrl: '/apps/tinyurl'`, `callbackPath: '/apps/tinyurl/auth/callback'`, `apiUrlPrefixes: ['/apps/tinyurl/api/']`, `apiBaseUrl: ''`, `identityLoginBaseUrl: ''`, `publicBaseUrl: ''`.
- `project.json` production `baseHref: "/apps/tinyurl/"`; `webpack.config.js` set `mfConfig.output.publicPath = 'auto'` and verify built chunk URLs.

- [ ] **Step 4: Run specs, build, inspect output**

Run: `npx nx test tinyurl-microfrontend && npx nx build tinyurl-microfrontend`
Then: `Select-String -Path dist/projects/tinyurl/microfrontend/index.html -Pattern 'src='`
Expected: all chunk/script URLs resolve under `/apps/tinyurl/`; no `localhost`.

- [ ] **Step 5: Commit**

```bash
git add projects/tinyurl/microfrontend
git commit -m "feat(tinyurl): serve the app under /apps/tinyurl"
```

---

### Task 8: Shell config, jar names, Dockerfiles

**Files:**
- Modify: `platform/shell/host/src/app/app.config.ts:15`
- Modify: `platform/identity/src/main/java/.../IdentityProperties.java`,
  `platform/identity/src/main/java/.../token/JwtIssuer.java`
- Test: `platform/identity/src/test/java/.../token/JwtIssuerTest.java`
- Modify: `platform/shell/build.gradle.kts`, `platform/identity/build.gradle.kts`
- Create: `platform/shell/Dockerfile`, `platform/identity/Dockerfile`

**Interfaces:**
- Produces: images `supportfolio/shell:demo`, `supportfolio/identity:demo`; jars `shell.jar`, `identity.jar`.

- [ ] **Step 1: Make the shell same-origin and pin jar names**

`provideAuth({ identityLoginBaseUrl: '' })`. In both `build.gradle.kts` add:

```kotlin
tasks.bootJar { archiveFileName = "shell.jar" }        // identity.jar in platform/identity
```

Also disable the plain jar (`tasks.jar { enabled = false }`) so `build/libs/*.jar` is unambiguous.

Containers cannot pass a multi-line PEM cleanly through an environment variable, so add a file-based
variant: `IdentityProperties` gains `jwtPrivateKeyFile` (nullable, no default change), and `JwtIssuer`
reads the PEM from that path when `jwtPrivateKeyPem` is blank. Write the failing test first in
`JwtIssuerTest`: write a PKCS#8 PEM to a temp file, construct `IdentityProperties` with
`jwtPrivateKeyFile` set and a blank PEM, and assert a token still signs and its `kid` matches the
JWKS. Then implement. Committed with this task.

- [ ] **Step 2: Write the Dockerfiles**

Identity: `FROM eclipse-temurin:17.0.20.1_1-jre-jammy`, `COPY platform/identity/build/libs/identity.jar /app/app.jar`, `EXPOSE 8081`, healthcheck on `/actuator/health`.

Shell: same base; copies `platform/shell/build/libs/shell.jar`, `dist/platform/shell/host/` (use the
`browser/` subdirectory if the Angular 22 builder emits one) → `/app/static/`, and
`dist/projects/tinyurl/microfrontend/` → `/app/static/apps/tinyurl/`; `ENV
SPRING_WEB_RESOURCES_STATIC_LOCATIONS=classpath:/static/,file:/app/static/`; `EXPOSE 8080`.

- [ ] **Step 3: Build and verify both images**

Run:
`.\gradlew.bat :platform:identity:bootJar :platform:shell:bootJar`
`npx nx build shell-host; npx nx build tinyurl-microfrontend`
`docker build -f platform/identity/Dockerfile -t supportfolio/identity:demo .`
`docker build -f platform/shell/Dockerfile -t supportfolio/shell:demo .`
Expected: both images build; `docker run --rm supportfolio/shell:demo ls /app/static/apps` lists `tinyurl`.
Then verify the bundle leak is gone:
`Select-String -Path dist/platform/shell/host/**/*.js,dist/projects/tinyurl/microfrontend/**/*.js -Pattern 'localhost:8081'`
Expected: no matches.

- [ ] **Step 4: Commit**

```bash
git add platform/shell platform/identity
git commit -m "build: package shell and identity images"
```

---

### Task 9: Demo compose stack and runner script

**Files:**
- Create: `docker-compose.demo.yml`, `scripts/demo.ps1`
- Modify: `projects/tinyurl/README.md`, `platform/shell/README.md` (run instructions)

**Interfaces:**
- Consumes: the two images from Task 8, TinyURL's existing image, `platform/identity/dev-key.pem`.
- Produces: `docker compose -f docker-compose.demo.yml --profile tunnel up -d --build`; tunnel logs contain `https://<random>.trycloudflare.com`.

- [ ] **Step 1: Write the compose file**

Services and key env:

| Service | Notes |
|---|---|
| `postgres` | `postgres:18-alpine`, healthcheck `pg_isready`, volume `tinyurl-pgdata` |
| `identity` | image `supportfolio/identity:demo`; `GITHUB_CLIENT_ID=demo`, `GITHUB_CLIENT_SECRET=demo`, `SUPPORTFOLIO_IDENTITY_ISSUER=http://identity:8081`, `SUPPORTFOLIO_IDENTITY_DEMO_ENABLED=${DEMO_ENABLED:-false}`, `SUPPORTFOLIO_IDENTITY_ADMIN_LOGIN=demo`, `SUPPORTFOLIO_IDENTITY_ALLOWLIST=demo`, `SUPPORTFOLIO_IDENTITY_REDIRECT_ORIGINS=http://localhost:18080`, `SUPPORTFOLIO_IDENTITY_JWT_PRIVATE_KEY_FILE=/keys/dev-key.pem`; mounts `./platform/identity/dev-key.pem:/keys/dev-key.pem:ro` |
| `tinyurl-service` | image `supportfolio/tinyurl:demo` built from `projects/tinyurl/Dockerfile` at repo root; `SPRING_DATASOURCE_URL=jdbc:postgresql://postgres:5432/tinyurl`, `SUPPORTFOLIO_TINYURL_DB_USER/PASSWORD`, `SUPPORTFOLIO_TINYURL_JWK_SET_URI=http://identity:8081/oauth2/jwks`, `SUPPORTFOLIO_TINYURL_ISSUER_URI=http://identity:8081`, `SUPPORTFOLIO_TINYURL_IDENTITY_URI=http://identity:8081`, `SUPPORTFOLIO_TINYURL_DEMO_SEED_ENABLED=${DEMO_ENABLED:-false}` |
| `shell` | image `supportfolio/shell:demo`; `SUPPORTFOLIO_SHELL_IDENTITY_URI=http://identity:8081`, `SUPPORTFOLIO_SHELL_TINYURL_URI=http://tinyurl-service:8082`, `SUPPORTFOLIO_SHELL_JWK_SET_URI=http://identity:8081/oauth2/jwks`, `SUPPORTFOLIO_SHELL_ISSUER_URI=http://identity:8081`, `SUPPORTFOLIO_SHELL_DEMO_LOGIN_ENABLED=${DEMO_ENABLED:-false}`, `SUPPORTFOLIO_SHELL_TRUSTED_REMOTE_ORIGINS=`, `SUPPORTFOLIO_SHELL_REMOTE_REGISTRY_FILE=/config/remote-registry.json`; mounts `./platform/shell/config/remote-registry.json:/config/remote-registry.json:ro`; publishes `127.0.0.1:18080:8080` |
| `tunnel` | profile `tunnel`; `cloudflare/cloudflared`; `tunnel --no-autoupdate --metrics 0.0.0.0:20241 --url http://shell:8080`; healthcheck on `/ready`; depends on shell healthy |

All app services get healthchecks and `depends_on: service_healthy`.

- [ ] **Step 2: Write `scripts/demo.ps1`**

Steps: fail fast if `openssl` missing and `platform/identity/dev-key.pem` absent (generate 2048-bit PKCS#8 PEM there, gitignored); run the Gradle bootJars and two Nx builds; `docker compose -f docker-compose.demo.yml up -d --build --wait` for the core services, then `docker compose -f docker-compose.demo.yml --profile tunnel up -d tunnel`; poll `docker compose logs tunnel` up to 60s for a URL; print it plus "keep the laptop awake" and the reset command. Parameter `-NoTunnel` skips the tunnel service so CI can reuse the script. Document in the README that `ngrok http 18080` is a drop-in fallback if `trycloudflare.com` is blocked, because nothing depends on cloudflared specifics.

- [ ] **Step 3: Validate configuration**

Run: `docker compose -f docker-compose.demo.yml config --quiet`
Expected: exit 0, no warnings about undefined variables.

- [ ] **Step 4: Manual smoke (local, tunnel allowed)**

Run: `.\scripts\demo.ps1`
Expected: prints an `https://…trycloudflare.com` URL; `GET <url>/api/remote-registry` returns the tinyurl project; `<url>/apps/tinyurl/` serves the app; restarting only `tunnel` prints a new URL that works with no rebuild. Record the observed URL in the commit message body.

- [ ] **Step 5: Commit**

```bash
git add docker-compose.demo.yml scripts/demo.ps1 projects/tinyurl/README.md platform/shell/README.md
git commit -m "feat: add demo compose stack and tunnel runner"
```

---

### Task 10: Seed demo links

**Files:**
- Create: `projects/tinyurl/service/src/main/java/.../demo/DemoDataSeeder.java`
- Create: `projects/tinyurl/service/src/test/java/.../demo/DemoDataSeederTest.java`
- Add `supportfolio.tinyurl.demo-seed-enabled` (default false) to `TinyUrlProperties` or the seeder's `@ConditionalOnProperty`; wire the env in compose.

**Interfaces:**
- Consumes: `LinkRepository`, `LinkClickRepository`, `Clock`.
- Produces: five links with clicks when enabled and the table is empty; idempotent.

- [ ] **Step 1: Write the failing test**

```java
@SpringBootTest(properties = "supportfolio.tinyurl.demo-seed-enabled=true")
class DemoDataSeederTest extends PostgresIntegrationTest {
  @Autowired LinkRepository links;
  @Test void seedsFiveLinksWithClicks() {
    assertThat(links.count()).isEqualTo(5);
    // and at least one has click_count > 0 via GET /api/links or the projection
  }
}
```

Add a second context test with the property absent asserting `count() == 0`.

- [ ] **Step 2: Run to verify failure**

Run: `.\gradlew.bat :projects:tinyurl:service:test --tests "*DemoDataSeederTest"`
Expected: FAIL — count 0.

- [ ] **Step 3: Implement**

`@Component @ConditionalOnProperty(name="supportfolio.tinyurl.demo-seed-enabled", havingValue="true")` implementing `ApplicationRunner`: if `links.count() == 0`, insert five deterministic links (e.g. `docs`, `spring`, `angular`, `k3s-retro`, `demo`) with `createdAt` spread over recent days and 0–7 click rows. Use the same repositories/services the app uses; no raw SQL.

- [ ] **Step 4: Run tests and commit**

Run: `.\gradlew.bat :projects:tinyurl:service:test`
Expected: PASS.

```bash
git add projects/tinyurl/service/src
git commit -m "feat(tinyurl): seed demo links on startup"
```

---

### Task 11: Delete k3s/arm64/deploy artifacts and rewrite their validators

**Files:**
- Delete: `projects/tinyurl/deploy/` (all 7), `projects/tinyurl/ci/trivy.yaml`,
  `tools/validate-tinyurl-deploy.spec.ts`
- Modify: `tools/validate-tinyurl-docs.spec.ts`, `tools/validate-workflows.spec.ts`,
  `tools/branch-protection.ts`, `tools/branch-protection.spec.ts`,
  `tools/sync-harness-workflows.ts`, `platform/harness/ACTIVATION.md`,
  `projects/tinyurl/README.md`, `.github/workflows/deploy.yml` (delete),
  `platform/harness/workflows/deploy.yml` (delete)

**Interfaces:**
- Produces: no k3s/arm64/deploy references anywhere; required check list contains `demo-stack` (Task 12) instead of `tinyurl-k3s-manifests`.

- [ ] **Step 1: Delete the artifacts, then run the tools tests to see the real breakage**

Run: `npx jest tools`
Expected: FAIL listing exactly the assertions named in the spec's delete-list impact (deploy README, k3s job, arm64 strings, `manifests-path`).

- [ ] **Step 2: Rewrite the assertions**

- `validate-workflows.spec.ts`: drop the arm64/attestation/trivy/k3s/ARM-runner/deploy blocks; assert instead that `tinyurl-ci.yml` contains a `demo-stack` job that runs `docker compose -f docker-compose.demo.yml` and the Playwright demo spec, and that `deploy.yml` no longer exists.
- `validate-tinyurl-docs.spec.ts`: remove the deploy README assertion and the `tinyurl-k3s-manifests` check; keep the environment-protection assertion only if `deploy.yml` still exists (it does not — drop it); replace the `4201` assertion with `/apps/tinyurl`.
- `branch-protection.ts` + spec: replace `tinyurl-k3s-manifests` with `demo-stack`.
- `sync-harness-workflows.ts`: remove `deploy.yml` from the sync list.
- `ACTIVATION.md`: replace the k3s/GHCR check description with the demo-stack description.

- [ ] **Step 3: Run the tools tests and commit**

Run: `npx jest tools`
Expected: PASS.

```bash
git add -A tools platform/harness projects/tinyurl/README.md .github/workflows/deploy.yml
git commit -m "chore: remove k3s and arm64 deployment path"
```

---

### Task 12: Replace image/k3s CI jobs with the demo-stack proof

**Files:**
- Modify: `.github/workflows/tinyurl-ci.yml`
- Create: `projects/tinyurl/ci/demo-login.spec.ts`, `projects/tinyurl/ci/playwright.demo.config.ts`
- Delete: `projects/tinyurl/ci/{prod-login.spec.ts,playwright.prod.config.ts,docker-compose.prod-e2e.yml,stub-identity/}`
- Modify: `tools/prod-bundle-gate.ts` (+ spec), `.github/workflows/platform-ci.yml` if job names change.

**Interfaces:**
- Produces: job `demo-stack` (ubuntu-latest): builds jar + dists, `docker compose -f docker-compose.demo.yml up -d --build --wait`, Playwright runs `demo-login.spec.ts` against `http://localhost:18080`, teardown `down -v`.

- [ ] **Step 1: Write the failing bundle-gate spec**

`prod-bundle-gate.spec.ts`: a dist containing `http://localhost:8081` fails for **both** shell and tinyurl dirs; the gate CLI accepts multiple paths.

- [ ] **Step 2: Write the Playwright spec**

`demo-login.spec.ts` (same assertions as the deleted prod spec, retargeted):
anonymous `GET /` shows the grid/card; open `/apps/tinyurl/`; anonymous `POST /apps/tinyurl/api/links` → 401; click the demo sign-in; assert signed-in state; shorten; read `short-link` href and assert it starts with `http://localhost:18080/go/`; follow twice; assert count `2`.

- [ ] **Step 3: Rewrite `tinyurl-ci.yml`**

Keep `tinyurl-backend`, `tinyurl-frontend`; reduce `tinyurl-image` to a local build (no GHCR/buildx/arm64/trivy); delete `tinyurl-k3s-manifests`, `tinyurl-arm-smoke`, `deploy-test`, `deploy-prod`; add `demo-stack`. Give it `npm ci`, JDK setup, the two Gradle bootJars, the two Nx builds, compose up with `--wait`, Playwright, and `docker compose ... down -v` with `if: always()`.

- [ ] **Step 4: Run the bundle gate locally, then push and watch the job**

Run: `npx tsx tools/prod-bundle-gate.ts dist/platform/shell/host dist/projects/tinyurl/microfrontend`
Expected: PASS (no `localhost:8081`).
Push the branch and confirm `demo-stack` is the only new required check.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows projects/tinyurl/ci tools
git commit -m "ci: prove the demo stack instead of a cluster"
```

---

### Task 13: Amend the Oracle/k3s docs and fix the repo map

**Files:**
- Modify: `docs/superpowers/specs/2026-10-16-portfolio-platform-design.md`
- Modify: `docs/superpowers/specs/2026-10-20-tinyurl-design.md`
- Modify: `docs/superpowers/retrospectives.md` (two `Ruling:` lines)
- Create: `docs/superpowers/ROADMAP.md`
- Modify: `AGENTS.md`, `projects/tinyurl/README.md`, `platform/shell/README.md`

**Interfaces:**
- Produces: no spec section still instructs Oracle VM, k3s, DNS/TLS, GHCR, arm64 or CD; both specs link to the new design; `AGENTS.md` names real projects and the demo commands.

- [ ] **Step 1: Amend the platform spec**

Replace the "dev = Docker Compose, test/prod = k3s on Oracle Always Free ARM VM" decision with the local compose + Quick Tunnel model. Add at the top of the affected section:

> Amended 2026-11-18: the Oracle/k3s deployment is replaced by the local Docker Compose + Cloudflare Quick Tunnel showcase model. See `2026-11-18-showcase-deployment-design.md`. Long-term hosting remains an open question.

Leave goals, personas, anti-goals and the monorepo layout untouched.

- [ ] **Step 2: Amend the TinyURL spec**

Mark acceptance criteria 11 (arm64 image), 12 (k3s manifests), 13 (GHCR attestation) as superseded, with the replacement criteria (demo stack, `/apps/tinyurl/`, absolute short URL, demo login). Rewrite the scope boundary so the successor is a future hosting plan, not the cluster plan.

- [ ] **Step 3: Write the two Ruling lines**

At the top of `retrospectives.md`, newest first, after the last entry:

```
## 2026-11-18 · Ruling (task: showcase deployment)

- `Ruling:` Amended two specs marked "read-only records" in place (Oracle/k3s → Cloudflare Quick Tunnel) at the human's explicit request; changes are dated and link the new design.
- `Ruling:` Edited `platform/shell/config/remote-registry.json` (listed under "Do not touch") to root-relative URLs, required for hostname independence; the file remains hot-read and uncached.
```

- [ ] **Step 4: Fix `AGENTS.md` and READMEs**

Repo map: `platform/shell` (gateway + host), `platform/identity`, `platform/shared-spring-starter`, `platform/shared-ui-lib`, `projects/tinyurl/{service,microfrontend}`, `tools/`. Add the demo commands (`.\scripts\demo.ps1`, reset command) and the CI gate list actually used by `tinyurl-ci.yml`.

- [ ] **Step 5: Create `docs/superpowers/ROADMAP.md`**

One table, human-readable, statuses only — no task breakdowns:

| Plan | Scope | Status |
|---|---|---|
| 1 — repo/harness foundations | monorepo, conventions, shared libs, CI workflows, governance | done (merged, Oct 2026) |
| 2 — Identity service | GitHub OAuth → JWT, provider port, resource-server starter | done (PR #17) |
| 3 — shell/gateway | hot-read registry, CSP, Angular host, shared card | done (PR #17) |
| 4 — TinyURL | full project slice, deploy-ready artifacts | done (PR #20) |
| 5 — showcase deployment | local compose + Cloudflare Quick Tunnel, `/apps/<id>/` hosting, demo login | **this plan** |
| 6 — admin-triage | telemetry + triage dashboard, "Add new app" flow | next (not started) |
| future — real hosting | domain, TLS, VPS/cloud, CD | not planned |

Footer line: "Plan documents live in `docs/superpowers/plans/`; designs in `docs/superpowers/specs/`; learnings in `retrospectives.md`. Update this table when a plan merges."

- [ ] **Step 6: Verify docs and commit**

Run: `npx prettier --check "platform/**/*.{ts,html}" "tools/**/*.ts" "eslint.config.mjs" "jest.config.ts" "jest.preset.js"`
Run: `git grep -n -i "oracle\|k3s\|arm64\|ghcr" -- docs/superpowers/specs AGENTS.md`
Expected: only dated amendment notes remain; no instruction text.

```bash
git add docs AGENTS.md projects/tinyurl/README.md platform/shell/README.md
git commit -m "docs: replace oracle/k3s plan with tunnel deployment"
```

---

### Task 14: Full verification, dry run, retrospective

**Files:**
- Modify: `docs/superpowers/retrospectives.md` (plan retrospective entry)

- [ ] **Step 1: Run every gate**

```powershell
.\gradlew.bat build
.\gradlew.bat -p build-logic test
npx nx run-many -t lint test --projects=shared-ui-lib,shell-host,tinyurl-microfrontend
npx nx build shell-host
npx nx build tinyurl-microfrontend
npx e2e shell-host-e2e
npx jest tools
npx prettier --check "platform/**/*.{ts,html}" "tools/**/*.ts" "eslint.config.mjs" "jest.config.ts" "jest.preset.js"
```
Expected: all green.

- [ ] **Step 2: Prove hostname independence**

Start the stack, note URL A, run `docker compose -f docker-compose.demo.yml --profile tunnel restart tunnel`, note URL B; open B and repeat the accept flow (grid → app → demo login → shorten → `/go` → count). Expected: works on B with no rebuild and no file edit.

- [ ] **Step 3: Prove the demo flags are inert**

`docker compose ... down`, bring the stack up without `DEMO_ENABLED`, then `curl -i -X POST http://localhost:18080/api/demo-login` → not 200, and the seeder leaves the table empty.

- [ ] **Step 4: Write the plan retrospective**

Add one timestamped, plan-tagged entry at the top of `retrospectives.md` answering what went well / what to continue / what to stop, per the binding rule.

- [ ] **Step 5: Commit and open the PR**

```bash
git add docs/superpowers/retrospectives.md
git commit -m "docs: add showcase deployment retrospective"
gh pr create --base main --title "feat: showcase deployment via Cloudflare Quick Tunnel" \
  --body "Replaces the never-built Oracle/k3s path with a local compose stack published through a Cloudflare Quick Tunnel. See docs/superpowers/specs/2026-11-18-showcase-deployment-design.md and docs/superpowers/plans/2026-11-18-showcase-deployment.md."
```

Wait for the required checks, then hand the URL to the reviewer.
