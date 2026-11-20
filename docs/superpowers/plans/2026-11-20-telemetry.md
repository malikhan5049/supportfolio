# Plan 6 — Per-Service Telemetry on Management Ports + Observability Profile

**Goal:** Move every Spring service's actuator surface (health + Prometheus metrics) onto a
per-service, env-overridable management port, and add an opt-in `observability` compose profile
(Prometheus + Grafana) that scrapes those ports without exposing them publicly.

**Architecture:** Each of the three Spring services gains `micrometer-registry-prometheus` and a
`management:` block whose `management.server.port` comes from a distinct env var (gateway 9091,
identity 9092, TinyURL 9093). Spring Boot then serves the *whole* actuator — health included — in a
separate management child context on that port, never published in compose and never proxied by the
gateway or the tunnel; compose healthchecks, the identity/shell Dockerfile `HEALTHCHECK`s, and the
existing main-port health tests are retargeted in the same tasks. `docker-compose.demo.yml` gains a
profile-gated `prometheus` + `grafana` pair with file-provisioned scrape config, datasource, and one
dashboard, reachable only on `127.0.0.1`.

**Tech Stack:** JDK 17 (Gradle wrapper), Spring Boot 4.1.1 + Spring Boot Actuator +
Micrometer `micrometer-registry-prometheus`, Docker Compose v2 profiles, Prometheus, Grafana,
PowerShell 7/5.1 script, GitHub Actions.

**Spec:** docs/superpowers/specs/2026-11-20-telemetry-design.md

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## Global Constraints

- All service URLs stay **root-relative**; no absolute-host URLs in config or dashboards.
- **No second copy of security headers/CSP** outside `platform/shell` — telemetry must not add a
  security filter chain of its own.
- **No metrics on the public tunnel or the main service port.** Management ports are never
  `ports:`-published to the host except Prometheus (19090) and Grafana (13000) on `127.0.0.1`.
- **No coupling into `demo-login` / seeder code paths.**
- **JDK 17 + Gradle wrapper only** (`.\gradlew.bat` locally on Windows PowerShell, `./gradlew` in CI).
- **Windows/PowerShell first** for local commands; script changes must keep working under
  `Set-StrictMode -Version Latest`.
- **Conventional commits**, one per task, on a feature branch — never commit to `main`.
- **`.\gradlew.bat build` is a per-task gate for every yaml-touching task** (standing retro item).
- Management ports are **env-overridable with distinct defaults**: `SUPPORTFOLIO_SHELL_MANAGEMENT_PORT`
  = 9091, `SUPPORTFOLIO_IDENTITY_MANAGEMENT_PORT` = 9092, `SUPPORTFOLIO_TINYURL_MANAGEMENT_PORT` = 9093.
- The management context is **unauthenticated by design** (never published, never proxied) — each
  yaml block carries a comment saying exactly that, so it is not "fixed" later by mistake.
- Tests set `management.server.port=0` and read the real port via `@LocalManagementPort`.

### Two facts that differ from the original framing (verified in-repo)

1. **The shell is servlet, not reactive.** `platform/shell/build.gradle.kts:13` pulls
   `spring-cloud-starter-gateway-server-webmvc` and `application.yaml:26` configures
   `spring.cloud.gateway.server.webmvc.routes`. Use the servlet actuator semantics (same as the other
   two services); do **not** add WebFlux-only config.
2. **A main-port `/actuator/prometheus` probe cannot assert a literal 404.** Once the endpoint leaves
   the main context, Spring Security answers the unknown path via its entry point: identity sends
   `401` (`SecurityConfig` entry point), TinyURL/shell answer `401`/`403`/`404` depending on the
   matcher. Assert "not 200 / no metrics payload" against the exact closed set `{401, 403, 404}` so
   the test states the real invariant instead of an unverified status code.

## Review Focus

These are the failure modes the per-task tests do **not** exercise — review them by hand on the PR:

1. **One healthcheck retargeted and two missed → `docker compose up --wait` hangs forever.** The
   probes live in three different places: `docker-compose.demo.yml` (identity :33, tinyurl :57,
   shell :82), `platform/identity/Dockerfile:10-11`, `platform/shell/Dockerfile:14-15`, and
   `projects/tinyurl/Dockerfile`. Any probe left on the old port turns `--wait` into a 20-minute
   timeout, not an error message.
2. **Scrape target wrong because the yaml env-var name and the compose env var disagree.** The yaml
   default is `9092`; if compose sets `SUPPORTFOLIO_IDENTITY_MANAGEMENT_PORT_ADDR` (typo) the app
   still binds 9092 and Prometheus still looks right — but flip the direction (compose sets a port the
   yaml doesn't read) and the target shows `down` while the service is healthy. Cross-check
   `docker compose config` env entries against the exact `${VAR:default}` strings in the three yamls.
3. **A management port published by accident.** Any `ports:` entry mapping 9091/9092/9093 to a host
   port puts metrics on the public host surface (and, if it lands on the tunnel's port, on the
   internet). Grep `docker-compose.demo.yml` for `909`.
4. **A stale permit path left in place silently keeps a dead route "green".** `SecurityConfig:38-39`
   and `application.yaml:16` (shell) / `:11` (TinyURL) still list `/actuator/health`; leaving them
   means a future re-add of the endpoint on the main port is permitted without review, and it hides
   whether the paths were actually moved.
5. **Grafana dashboard datasource UID mismatch → empty panels on a healthy stack.** The dashboard JSON
   references a datasource by UID; provisioning must declare that *same* UID (`supportfolio-prometheus`)
   and `dashboards.yml` must point Grafana at the mounted directory. Also check the query metric names
   against a live `/actuator/prometheus` dump — a renamed `http_server_requests_*` metric yields panels
   that load and render "No data" while all tests pass.

## Task 1 — Identity: Prometheus registry, management port 9092, drop stale permits

**Files:**
- Modify: `platform/identity/build.gradle.kts` (dependencies block, after line 9)
- Modify: `platform/identity/src/main/resources/application.yaml` (append `management:` block)
- Modify: `platform/identity/src/main/java/com/supportfolio/platform/identity/login/SecurityConfig.java` (lines 38-39)
- Modify: `platform/identity/src/test/java/com/supportfolio/platform/identity/login/SecurityConfigTest.java` (lines 78-80)
- Create: `platform/identity/src/test/java/com/supportfolio/platform/identity/telemetry/ManagementEndpointTest.java`

**Interfaces:**
- Consumes: `spring-boot-starter-actuator` (already supplied by
  `build-logic/src/main/kotlin/supportfolio.spring-service-conventions.gradle.kts:43`); Boot 4.1.1's
  dependency management for `io.micrometer:micrometer-registry-prometheus`.
- Produces: on the management port `${SUPPORTFOLIO_IDENTITY_MANAGEMENT_PORT:9092}` —
  `/actuator/health`, `/actuator/health/liveness`, `/actuator/health/readiness`,
  `/actuator/prometheus`, `/actuator/info`, every series tagged `application="identity"`. The main
  port keeps `server.port: 8081` and no longer serves actuator.

- [ ] **Step 1: Write the failing test**

Create `platform/identity/src/test/java/com/supportfolio/platform/identity/telemetry/ManagementEndpointTest.java`.
Reuse the `@SpringBootTest` + `@TestPropertySource` block from
`IdentityFlowIntegrationTest` verbatim (it already supplies issuer/admin/allowlist/redirect/JWK
properties) and add `management.server.port=0`:

```java
package com.supportfolio.platform.identity.telemetry;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalManagementPort;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.ResponseEntity;

// Same @TestPropertySource block as IdentityFlowIntegrationTest, plus a random management port.
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ManagementEndpointTest {

  @LocalServerPort private int appPort;

  @LocalManagementPort private int managementPort;

  @Autowired private TestRestTemplate rest;

  @Test
  void managementPortIsSeparateFromMainPort() {
    assertThat(managementPort).isNotEqualTo(appPort);
  }

  @Test
  void healthIsServedOnManagementPort() {
    ResponseEntity<String> response =
        rest.getForEntity("http://localhost:" + managementPort + "/actuator/health", String.class);

    assertThat(response.getStatusCode().value()).isEqualTo(200);
    assertThat(response.getBody()).contains("\"status\":\"UP\"");
  }

  @Test
  void healthGroupsAreServedOnManagementPort() {
    for (String group : new String[] {"liveness", "readiness"}) {
      ResponseEntity<String> response =
          rest.getForEntity(
              "http://localhost:" + managementPort + "/actuator/health/" + group, String.class);

      assertThat(response.getStatusCode().value()).as(group).isEqualTo(200);
      assertThat(response.getBody()).as(group).contains("\"status\":\"UP\"");
    }
  }

  @Test
  void prometheusIsServedOnManagementPort() {
    ResponseEntity<String> response =
        rest.getForEntity(
            "http://localhost:" + managementPort + "/actuator/prometheus", String.class);

    assertThat(response.getStatusCode().value()).isEqualTo(200);
    assertThat(response.getHeaders().getContentType()).isNotNull();
    assertThat(response.getBody()).contains("jvm_memory_used_bytes");
    assertThat(response.getBody()).contains("application=\"identity\"");
  }

  @Test
  void prometheusIsNotServedOnMainPort() {
    ResponseEntity<String> response =
        rest.getForEntity("http://localhost:" + appPort + "/actuator/prometheus", String.class);

    // Security entry point answers unknown anonymous paths with 401/403/404 — never 200.
    assertThat(response.getStatusCode().value()).isIn(401, 403, 404);
    assertThat(response.getBody()).doesNotContain("jvm_memory_used_bytes");
  }
}
```

- [ ] **Step 2: Run it and confirm RED**

```powershell
.\gradlew.bat :platform:identity:test --tests "*ManagementEndpointTest"
```

Expected: `managementPortIsSeparateFromMainPort` FAILS (no management port configured, so
`@LocalManagementPort` falls back to the app port) and `prometheusIsServedOnManagementPort` FAILS with
404 (default exposure is `health` only, no Prometheus registry). `healthIsServedOnManagementPort` may
already pass on the main port — that is fine; the RED gate is the port-separation and Prometheus tests.

- [ ] **Step 3: Implement — dependency, config, permits**

`platform/identity/build.gradle.kts`, inside `dependencies { }` after the
`spring-security-oauth2-jose` line:

```kotlin
    // Prometheus-format metrics for the management endpoint; version-managed by the Boot BOM.
    implementation("io.micrometer:micrometer-registry-prometheus")
```

`platform/identity/src/main/resources/application.yaml`, append at end of file:

```yaml
# Actuator lives on a dedicated management port (all endpoints, health included).
# The management context is intentionally UNAUTHENTICATED: the port is never published by
# docker-compose and never proxied by the shell or the Cloudflare tunnel. Do not add it to
# SecurityConfig's public matchers — it is a separate, non-public context.
management:
  server:
    port: ${SUPPORTFOLIO_IDENTITY_MANAGEMENT_PORT:9092}
  endpoints:
    web:
      exposure:
        include: health,info,prometheus
  endpoint:
    health:
      probes:
        enabled: true
      group:
        liveness:
          include: livenessState
        readiness:
          include: readinessState
  metrics:
    tags:
      application: identity
```

`platform/identity/src/main/java/com/supportfolio/platform/identity/login/SecurityConfig.java` — delete
the two stale entries at lines 38-39 (`"/actuator/health",` and `"/actuator/health/**",`) so the
matcher list starts at `"/oauth2/jwks",`.

- [ ] **Step 4: Retarget `SecurityConfigTest.actuatorHealthEndpointStaysPublic`**

`SecurityConfigTest:78-79` asserts `mockMvc.perform(get("/actuator/health")).andExpect(status().isOk())`
against the **main** servlet context. MockMvc cannot see the management child context, so the honest
retarget is: **delete** that test method from `SecurityConfigTest` (its behaviour is now covered by
`ManagementEndpointTest.healthIsServedOnManagementPort`) and leave the rest of the class untouched. If
`SecurityConfigTest` runs on a real port rather than MockMvc, instead rewrite the method in place as
`actuatorHealthIsNotServedOnMainPort` asserting `401`/`403`/`404` on `/actuator/health`. Verify which
case applies by reading the class annotations before editing.

- [ ] **Step 5: Run the retargeted tests — expect GREEN**

```powershell
.\gradlew.bat :platform:identity:test
```

Expected: BUILD SUCCESSFUL; `ManagementEndpointTest` 5 tests pass, `SecurityConfigTest` passes without
the removed method, `IdentityFlowIntegrationTest` unchanged.

- [ ] **Step 6: yaml-touching gate**

```powershell
.\gradlew.bat build
```

Expected: `BUILD SUCCESSFUL` (spotless + all module tests).

- [ ] **Step 7: Commit**

```powershell
git add platform/identity
git commit -m "feat(identity): serve actuator and prometheus on management port 9092"
```

## Task 2 — TinyURL service: move the existing `management` block to port 9093, add Prometheus

**Files:**
- Modify: `projects/tinyurl/service/build.gradle.kts` (dependencies block)
- Modify: `projects/tinyurl/service/src/main/resources/application.yaml` (lines 11, 18-31)
- Modify: `projects/tinyurl/service/src/test/java/com/supportfolio/tinyurl/health/HealthProbeTest.java` (lines 77-83 + new tests)
- Modify: `projects/tinyurl/service/src/test/java/com/supportfolio/tinyurl/web/AnonymousSurfaceMatrixTest.java` (lines 44-46)

**Interfaces:**
- Consumes: same convention-plugin actuator; existing `management:` block (yaml lines 18-31) as the
  precedent for probe groups.
- Produces: management port `${SUPPORTFOLIO_TINYURL_MANAGEMENT_PORT:9093}` serving
  `/actuator/health{,/liveness,/readiness}`, `/actuator/prometheus`, `/actuator/info`, series tagged
  `application="tinyurl-service"`. Main port 8082 loses the actuator.

- [ ] **Step 1: Write the failing tests (RED)**

In `HealthProbeTest` (it already owns a container and a running server), retarget the probe base URL
to the management port and add the new assertions. Field + helper:

```java
  @LocalManagementPort private int managementPort;

  private String managementUrl(String path) {
    return "http://localhost:" + managementPort + path;
  }
```

Retarget lines 77-78 and 82-83 to:

```java
    awaitStatus(managementUrl("/actuator/health/liveness"), 200, "UP");
    awaitStatus(managementUrl("/actuator/health/readiness"), 200, "UP");
```

and in the DB-down case:

```java
    awaitStatus(managementUrl("/actuator/health/liveness"), 200, "UP");
    awaitStatus(managementUrl("/actuator/health/readiness"), 503, "DOWN");
```

Add two new tests to the same class:

```java
  @Test
  void prometheusIsServedOnManagementPort() throws Exception {
    HttpResponse<String> response = get(managementUrl("/actuator/prometheus"));

    assertThat(response.statusCode()).isEqualTo(200);
    assertThat(response.body()).contains("jvm_memory_used_bytes");
    assertThat(response.body()).contains("application=\"tinyurl-service\"");
  }

  @Test
  void prometheusIsNotServedOnMainPort() throws Exception {
    HttpResponse<String> response = get("http://localhost:" + port + "/actuator/prometheus");

    assertThat(response.statusCode()).isIn(401, 403, 404);
    assertThat(response.body()).doesNotContain("jvm_memory_used_bytes");
  }
```

(Match the file's existing HTTP helper/field for the main port; it already injects one.)

In `AnonymousSurfaceMatrixTest`, delete the three `/actuator/**` parameter rows at lines 44-46 — those
paths no longer exist on the main surface, and their replacement coverage is the management-port test
above. Leave the `/actuator/env → 401` row at line 55: it still documents that actuator paths are not
an anonymous surface on the main port.

- [ ] **Step 2: Run and confirm RED**

```powershell
.\gradlew.bat :projects:tinyurl:service:test --tests "*HealthProbeTest"
```

Expected: FAIL — `prometheusIsServedOnManagementPort` gets 404 (exposure is `health` only, no registry);
`healthGroupsAreServedOnManagementPort`-equivalent calls hit the main port because
`@LocalManagementPort` falls back to `server.port` (no management port configured yet).

- [ ] **Step 3: Implement**

`projects/tinyurl/service/build.gradle.kts`, inside `dependencies { }` (next to the other
`implementation` lines):

```kotlin
    // Prometheus-format metrics for the management endpoint; version-managed by the Boot BOM.
    implementation("io.micrometer:micrometer-registry-prometheus")
```

`projects/tinyurl/service/src/main/resources/application.yaml` — replace lines 18-31 with:

```yaml
# Actuator lives on a dedicated management port (all endpoints, health included).
# The management context is intentionally UNAUTHENTICATED: the port is never published by
# docker-compose and never proxied by the shell or the Cloudflare tunnel. Do not add it to
# supportfolio.security.permit-paths — it is a separate, non-public context.
management:
  server:
    port: ${SUPPORTFOLIO_TINYURL_MANAGEMENT_PORT:9093}
  endpoints:
    web:
      exposure:
        include: health,info,prometheus
  endpoint:
    health:
      probes:
        enabled: true
      group:
        liveness:
          include: livenessState
        readiness:
          include: readinessState,db
  metrics:
    tags:
      application: tinyurl-service
```

Line 11: drop `/actuator/health,/actuator/health/**` from `supportfolio.security.permit-paths`, leaving:

```yaml
    permit-paths: /v3/api-docs/**,/swagger-ui/**,/swagger-ui.html,/go/**,/api/token
```

- [ ] **Step 4: Run the retargeted tests — expect GREEN**

```powershell
.\gradlew.bat :projects:tinyurl:service:test --tests "*HealthProbeTest" --tests "*AnonymousSurfaceMatrixTest"
```

Expected: both classes pass; `HealthProbeTest` liveness/readiness UP, readiness 503-DOWN in the
DB-down case, Prometheus 200 on the management port and non-200 on the main port.

- [ ] **Step 5: yaml-touching gate**

```powershell
.\gradlew.bat build
```

Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 6: Commit**

```powershell
git add projects/tinyurl/service
git commit -m "feat(tinyurl): move actuator to management port 9093 and expose prometheus"
```

## Task 3 — Shell gateway: management port 9091, drop `/actuator/health` permit paths

**Files:**
- Modify: `platform/shell/build.gradle.kts` (dependencies block, after line 15)
- Modify: `platform/shell/src/main/resources/application.yaml` (line 16; append `management:` block)
- Create: `platform/shell/src/test/java/com/supportfolio/platform/shell/telemetry/ManagementEndpointTest.java`

**Interfaces:**
- Consumes: convention-plugin actuator; `@LocalServerPort` pattern already used by
  `GatewayRoutingTest:27` and `FeaturesControllerTest:17` for the `@SpringBootTest(RANDOM_PORT)` shape.
- Produces: management port `${SUPPORTFOLIO_SHELL_MANAGEMENT_PORT:9091}` serving
  `/actuator/health{,/liveness,/readiness}`, `/actuator/prometheus`, `/actuator/info`, series tagged
  `application="shell"`. Main port 8080 loses the actuator. Servlet stack (see "Two facts").

- [ ] **Step 1: Write the failing test**

Create the test mirroring `GatewayRoutingTest`'s annotations (`@SpringBootTest(webEnvironment =
RANDOM_PORT)`, its test property sources for the registry file / identity URIs) plus
`management.server.port=0`:

```java
package com.supportfolio.platform.shell.telemetry;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalManagementPort;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.ResponseEntity;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ManagementEndpointTest {

  @LocalServerPort private int appPort;

  @LocalManagementPort private int managementPort;

  @Autowired private TestRestTemplate rest;

  @Test
  void managementPortIsSeparateFromMainPort() {
    assertThat(managementPort).isNotEqualTo(appPort);
  }

  @Test
  void healthIsServedOnManagementPort() {
    ResponseEntity<String> response =
        rest.getForEntity("http://localhost:" + managementPort + "/actuator/health", String.class);

    assertThat(response.getStatusCode().value()).isEqualTo(200);
    assertThat(response.getBody()).contains("\"status\":\"UP\"");
  }

  @Test
  void prometheusIsServedOnManagementPort() {
    ResponseEntity<String> response =
        rest.getForEntity(
            "http://localhost:" + managementPort + "/actuator/prometheus", String.class);

    assertThat(response.getStatusCode().value()).isEqualTo(200);
    assertThat(response.getBody()).contains("jvm_memory_used_bytes");
    assertThat(response.getBody()).contains("application=\"shell\"");
  }

  @Test
  void prometheusIsNotServedOnMainPort() {
    ResponseEntity<String> response =
        rest.getForEntity("http://localhost:" + appPort + "/actuator/prometheus", String.class);

    assertThat(response.getStatusCode().value()).isIn(401, 403, 404);
    assertThat(response.getBody()).doesNotContain("jvm_memory_used_bytes");
  }
}
```

- [ ] **Step 2: Run and confirm RED**

```powershell
.\gradlew.bat :platform:shell:test --tests "*ManagementEndpointTest"
```

Expected: FAIL on `managementPortIsSeparateFromMainPort` (fallback to 8080-equivalent port) and
`prometheusIsServedOnManagementPort` (404 — no registry, `health` only).

- [ ] **Step 3: Implement**

`platform/shell/build.gradle.kts`, inside `dependencies { }` after
`spring-boot-starter-oauth2-resource-server`:

```kotlin
    // Prometheus-format metrics for the management endpoint; version-managed by the Boot BOM.
    implementation("io.micrometer:micrometer-registry-prometheus")
```

`platform/shell/src/main/resources/application.yaml` line 16: drop `,/actuator/health,/actuator/health/**`
so the value ends at `...,/robots.txt`. Append at end of file:

```yaml
# Actuator lives on a dedicated management port (all endpoints, health included).
# The management context is intentionally UNAUTHENTICATED: the port is never published by
# docker-compose and never proxied by the gateway or the Cloudflare tunnel. Do not add it to
# supportfolio.security.permit-paths — it is a separate, non-public context.
management:
  server:
    port: ${SUPPORTFOLIO_SHELL_MANAGEMENT_PORT:9091}
  endpoints:
    web:
      exposure:
        include: health,info,prometheus
  endpoint:
    health:
      probes:
        enabled: true
      group:
        liveness:
          include: livenessState
        readiness:
          include: readinessState
  metrics:
    tags:
      application: shell
```

- [ ] **Step 4: Run the shell suite — expect GREEN**

```powershell
.\gradlew.bat :platform:shell:test
```

Expected: BUILD SUCCESSFUL; `ManagementEndpointTest` passes, `GatewayRoutingTest`,
`FeaturesControllerTest`, shared-starter security tests unaffected.

- [ ] **Step 5: yaml-touching gate**

```powershell
.\gradlew.bat build
```

Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 6: Commit**

```powershell
git add platform/shell
git commit -m "feat(shell): serve actuator and prometheus on management port 9091"
```

## Task 4 — Compose + Dockerfiles: retarget every healthcheck to the management port

**Files:**
- Modify: `docker-compose.demo.yml` (identity healthcheck :32-36, tinyurl :56-60, shell :81-85; env blocks :21-29, :46-55, :71-78)
- Modify: `platform/identity/Dockerfile` (lines 8, 10-11)
- Modify: `platform/shell/Dockerfile` (lines 12, 14-15)
- Modify: `projects/tinyurl/Dockerfile` (EXPOSE + HEALTHCHECK, if present)

**Interfaces:**
- Consumes: management ports from Tasks 1-3 (9092 / 9093 / 9091), container-internal.
- Produces: every container reports healthy from its management port; `depends_on: service_healthy`
  chains (identity→postgres, tinyurl→postgres+identity, shell→identity+tinyurl) keep working; no
  management port published to the host.

- [ ] **Step 1: Establish the RED baseline (documented, not a unit test)**

```powershell
docker compose -f docker-compose.demo.yml config | Select-String -Pattern "actuator/health" -Context 0,0
```

Expected: three matches, all pointing at the **old** ports (`8081`, `8082`, `8080`) — record this
output in the PR description as the before-state.

- [ ] **Step 2: Retarget the compose healthchecks**

In `docker-compose.demo.yml`, replace the three `test:` lines so each probe uses the same env var the
service binds, with `$$` escaping so the *container* shell expands it at runtime:

```yaml
# identity (:33)
      test: ["CMD-SHELL", "curl -f http://localhost:$${SUPPORTFOLIO_IDENTITY_MANAGEMENT_PORT:-9092}/actuator/health"]
# tinyurl-service (:57)
      test: ["CMD-SHELL", "curl -f http://localhost:$${SUPPORTFOLIO_TINYURL_MANAGEMENT_PORT:-9093}/actuator/health"]
# shell (:82)
      test: ["CMD-SHELL", "curl -f http://localhost:$${SUPPORTFOLIO_SHELL_MANAGEMENT_PORT:-9091}/actuator/health"]
```

Add the ports to each service's `environment:` block so scraper targets and app bindings are visible
in one file (and the `:-default` above stays truthful):

```yaml
      SUPPORTFOLIO_IDENTITY_MANAGEMENT_PORT: "9092"      # identity
      SUPPORTFOLIO_TINYURL_MANAGEMENT_PORT: "9093"       # tinyurl-service
      SUPPORTFOLIO_SHELL_MANAGEMENT_PORT: "9091"         # shell
```

Do **not** add any `ports:` entry for these three values (Review Focus #3).

- [ ] **Step 3: Retarget the image probes**

`platform/identity/Dockerfile`:

```dockerfile
EXPOSE 8081 9092

HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
    CMD curl -fsS http://localhost:${SUPPORTFOLIO_IDENTITY_MANAGEMENT_PORT:-9092}/actuator/health || exit 1
```

`platform/shell/Dockerfile`: same shape with `EXPOSE 8080 9091` and
`${SUPPORTFOLIO_SHELL_MANAGEMENT_PORT:-9091}`.

`projects/tinyurl/Dockerfile`: mirror it — `EXPOSE 8082 9093` (append to the existing EXPOSE) and point
its `HEALTHCHECK` at `${SUPPORTFOLIO_TINYURL_MANAGEMENT_PORT:-9093}`. If it has no `HEALTHCHECK`, add
one in the same shape; compose's probe is still authoritative.

- [ ] **Step 4: Validate config and prove the stack still reaches healthy**

```powershell
docker compose -f docker-compose.demo.yml config | Select-String -Pattern "9091|9092|9093"
```

Expected: six lines — three env entries, three healthcheck URLs — and **no** `published:`/host-port
mapping for any of them.

```powershell
.\gradlew.bat build
docker compose -f docker-compose.demo.yml up -d --build --wait
docker compose -f docker-compose.demo.yml ps
```

Expected: `--wait` returns (no timeout), `ps` shows `healthy` for `postgres`, `identity`,
`tinyurl-service`, `shell`; `curl.exe -fsS http://localhost:18080/actuator/health` fails (no actuator
on the main port).

- [ ] **Step 5: Commit**

```powershell
git add docker-compose.demo.yml platform/identity/Dockerfile platform/shell/Dockerfile projects/tinyurl/Dockerfile
git commit -m "build(demo): retarget service healthchecks to management ports"
```

## Task 5 — Observability profile: Prometheus + Grafana with provisioning

**Files:**
- Create: `observability/prometheus/prometheus.yml`
- Create: `observability/grafana/provisioning/datasources/prometheus.yml`
- Create: `observability/grafana/provisioning/dashboards/dashboards.yml`
- Create: `observability/grafana/dashboards/supportfolio-services.json`
- Modify: `docker-compose.demo.yml` (insert two services before `volumes:` at line 115; add `prometheus-data` volume)

**Interfaces:**
- Consumes: management endpoints on the compose network — `shell:9091`, `identity:9092`,
  `tinyurl-service:9093`, all `/actuator/prometheus`.
- Produces: `observability` profile; Prometheus on `127.0.0.1:19090` (API `/api/v1/targets`,
  `/-/ready`); Grafana on `127.0.0.1:13000` (anonymous Viewer; admin password from
  `GRAFANA_ADMIN_PASSWORD`, default `admin`); datasource UID `supportfolio-prometheus`; one provisioned
  dashboard. Nothing here is reachable through the `tunnel` profile.

- [ ] **Step 1: Write the scrape config**

`observability/prometheus/prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: supportfolio-shell
    metrics_path: /actuator/prometheus
    static_configs:
      - targets: ["shell:9091"]

  - job_name: supportfolio-identity
    metrics_path: /actuator/prometheus
    static_configs:
      - targets: ["identity:9092"]

  - job_name: supportfolio-tinyurl
    metrics_path: /actuator/prometheus
    static_configs:
      - targets: ["tinyurl-service:9093"]
```

- [ ] **Step 2: Write the Grafana provisioning**

`observability/grafana/provisioning/datasources/prometheus.yml` — the UID here is the one the dashboard
JSON must reference (Review Focus #5):

```yaml
apiVersion: 1

datasources:
  - name: Supportfolio Prometheus
    uid: supportfolio-prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: false
    jsonData:
      timeInterval: 15s
```

`observability/grafana/provisioning/dashboards/dashboards.yml`:

```yaml
apiVersion: 1

providers:
  - name: supportfolio
    orgId: 1
    folder: Supportfolio
    type: file
    disableDeletion: false
    updateIntervalSeconds: 30
    allowUiUpdates: false
    options:
      path: /etc/grafana/dashboards
      foldersFromFilesStructure: false
```

- [ ] **Step 3: Write the dashboard**

`observability/grafana/dashboards/supportfolio-services.json` — a single dashboard, `uid`
`supportfolio-services`, templated on the common tag:

```json
{
  "uid": "supportfolio-services",
  "title": "Supportfolio services",
  "tags": ["supportfolio"],
  "timezone": "browser",
  "refresh": "30s",
  "time": { "from": "now-1h", "to": "now" },
  "templating": {
    "list": [
      {
        "name": "app",
        "label": "Application",
        "type": "query",
        "datasource": { "type": "prometheus", "uid": "supportfolio-prometheus" },
        "query": "label_values(jvm_memory_used_bytes, application)",
        "includeAll": true,
        "multi": true,
        "current": { "text": "All", "value": "$__all" }
      }
    ]
  },
  "panels": [
    {
      "type": "timeseries",
      "title": "Scrape target up",
      "gridPos": { "h": 6, "w": 8, "x": 0, "y": 0 },
      "datasource": { "type": "prometheus", "uid": "supportfolio-prometheus" },
      "targets": [
        { "expr": "up{job=~\"supportfolio-.*\"}", "legendFormat": "{{job}}", "refId": "A" }
      ]
    },
    {
      "type": "timeseries",
      "title": "JVM heap used bytes",
      "gridPos": { "h": 6, "w": 8, "x": 8, "y": 0 },
      "datasource": { "type": "prometheus", "uid": "supportfolio-prometheus" },
      "targets": [
        {
          "expr": "sum by (application) (jvm_memory_used_bytes{area=\"heap\",application=~\"$app\"})",
          "legendFormat": "{{application}}",
          "refId": "A"
        }
      ]
    },
    {
      "type": "timeseries",
      "title": "HTTP requests / second",
      "gridPos": { "h": 6, "w": 8, "x": 16, "y": 0 },
      "datasource": { "type": "prometheus", "uid": "supportfolio-prometheus" },
      "targets": [
        {
          "expr": "sum by (application) (rate(http_server_requests_seconds_count{application=~\"$app\"}[5m]))",
          "legendFormat": "{{application}}",
          "refId": "A"
        }
      ]
    },
    {
      "type": "timeseries",
      "title": "HTTP p95 latency (s)",
      "gridPos": { "h": 6, "w": 12, "x": 0, "y": 6 },
      "datasource": { "type": "prometheus", "uid": "supportfolio-prometheus" },
      "targets": [
        {
          "expr": "histogram_quantile(0.95, sum by (le, application) (rate(http_server_requests_seconds_bucket{application=~\"$app\"}[5m])))",
          "legendFormat": "{{application}}",
          "refId": "A"
        }
      ]
    }
  ]
}
```

Validate before moving on:

```powershell
Get-Content observability/grafana/dashboards/supportfolio-services.json -Raw | ConvertFrom-Json | Out-Null; "valid json"
```

Expected: `valid json`.

- [ ] **Step 4: Add the two compose services**

In `docker-compose.demo.yml`, insert **before** the `volumes:` key (currently line 115):

```yaml
  prometheus:
    profiles:
      - observability
    image: prom/prometheus:latest
    command:
      - --config.file=/etc/prometheus/prometheus.yml
      - --storage.tsdb.path=/prometheus
      - --web.listen-address=0.0.0.0:9090
    ports:
      - "127.0.0.1:19090:9090"
    volumes:
      - ./observability/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus-data:/prometheus
    healthcheck:
      # Prometheus ships busybox wget; /-/ready is the documented readiness probe.
      test: ["CMD-SHELL", "wget --spider -q http://localhost:9090/-/ready"]
      interval: 10s
      timeout: 5s
      retries: 10
    depends_on:
      shell:
        condition: service_healthy
      identity:
        condition: service_healthy
      tinyurl-service:
        condition: service_healthy

  grafana:
    profiles:
      - observability
    image: grafana/grafana:latest
    ports:
      - "127.0.0.1:13000:3000"
    environment:
      GF_SECURITY_ADMIN_USER: admin
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_ADMIN_PASSWORD:-admin}
      GF_AUTH_ANONYMOUS_ENABLED: "true"
      GF_AUTH_ANONYMOUS_ORG_ROLE: Viewer
      GF_USERS_ALLOW_SIGN_UP: "false"
      GF_DASHBOARDS_DEFAULT_HOME_DASHBOARD_PATH: /etc/grafana/dashboards/supportfolio-services.json
    volumes:
      - ./observability/grafana/provisioning:/etc/grafana/provisioning:ro
      - ./observability/grafana/dashboards:/etc/grafana/dashboards:ro
    depends_on:
      prometheus:
        condition: service_healthy
```

Deliberate: Grafana has **no** healthcheck (its image's HTTP tooling varies by tag), so `--wait` only
requires it to be running — Prometheus, which the CI job actually asserts on, does have one. Add
`prometheus-data:` next to `tinyurl-pgdata:` under the top-level `volumes:` key. Leave the `tunnel`
service untouched.

- [ ] **Step 5: Boot the profile and assert the targets**

```powershell
docker compose -f docker-compose.demo.yml config | Select-String -Pattern "19090|13000"
.\gradlew.bat build
docker compose -f docker-compose.demo.yml --profile observability up -d --build --wait
```

Expected: config shows only `127.0.0.1` bindings; `--wait` returns; `up` lists 6 containers.

```powershell
curl.exe -fsS http://127.0.0.1:19090/api/v1/targets | ConvertFrom-Json |
  Select-Object -ExpandProperty data | Select-Object -ExpandProperty activeTargets |
  Select-Object @{n='job';e={$_.labels.job}}, @{n='instance';e={$_.labels.instance}}, health
```

Expected: exactly three rows, `health` = `up`, instances `shell:9091`, `identity:9092`,
`tinyurl-service:9093`.

```powershell
curl.exe -fsS http://127.0.0.1:13000/api/health
curl.exe -fsS "http://127.0.0.1:13000/api/search?query=Supportfolio"
```

Expected: `{"database":"ok",...}` and a single hit with `uid: supportfolio-services`. Then open
`http://127.0.0.1:13000/d/supportfolio-services` as an anonymous viewer and confirm the four panels
render data (not "No data"). If a panel is empty, dump the real series from inside the network and fix
the metric names in the JSON to match (Review Focus #5):

```powershell
docker compose -f docker-compose.demo.yml exec shell wget -qO- http://localhost:9091/actuator/prometheus |
  Select-String "http_server_requests"
```

- [ ] **Step 6: Commit**

```powershell
git add observability docker-compose.demo.yml
git commit -m "feat(observability): add prometheus and grafana compose profile"
```

## Task 6 — `scripts/demo.ps1 -Observability`

**Files:**
- Modify: `scripts/demo.ps1` (param block :22-25, core-stack block :83-90, reset note :119-125)

**Interfaces:**
- Consumes: the `observability` profile from Task 5.
- Produces: `-Observability` switch; **without it the script behaves exactly as today**. With it, after
  the core stack is healthy the profile is brought up and the Grafana URL is printed.

- [ ] **Step 1: Write the failing check (script still rejects the parameter)**

```powershell
powershell -NoProfile -Command "& { .\scripts\demo.ps1 -Observability -WhatIf } 2>&1" 
```

Expected before the change: an error naming `Observability` as an unknown parameter — proving the
switch is what gates the new behaviour.

- [ ] **Step 2: Implement**

Parameter block (:22-25):

```powershell
param(
  [switch]$NoTunnel,
  [switch]$NoDemo,
  [switch]$Observability
)
```

Also extend the comment-based help with:

```powershell
.PARAMETER Observability
  Also start the observability profile (Prometheus + Grafana). Metrics ports are never
  published publicly; Grafana is on http://localhost:13000.
```

After the core stack is healthy and before the tunnel branch (:87 "if ($NoTunnel)"):

```powershell
  if ($Observability) {
    Write-Host 'Starting observability profile (Prometheus + Grafana)...' -ForegroundColor Cyan
    docker compose -f docker-compose.demo.yml --profile observability up -d --wait
    Write-Host 'Prometheus: http://localhost:19090' -ForegroundColor Green
    Write-Host 'Grafana:    http://localhost:13000 (anonymous viewer)' -ForegroundColor Green
  }
```

Refresh the closing note's reset command to mention the profile:

```
Reset command (destroys the database volume):
  docker compose -f docker-compose.demo.yml --profile observability --profile tunnel down -v
```

- [ ] **Step 3: Verify — syntax, then both paths**

```powershell
powershell -NoProfile -Command "$e=$null; [void][System.Management.Automation.Language.Parser]::ParseFile('scripts/demo.ps1',[ref]$null,[ref]$e); if ($e) { $e; exit 1 } else { 'parse ok' }"
```

Expected: `parse ok` (StrictMode-safe, no undefined variables).

```powershell
.\scripts\demo.ps1 -NoTunnel
```

Expected: identical output to the pre-change script — three jars, two frontends, three images, core
stack healthy, `Shell is available at http://localhost:18080`, **no** Prometheus/Grafana lines.

```powershell
.\scripts\demo.ps1 -NoTunnel -Observability
```

Expected: the above plus the observability lines and `docker compose ... ps` showing 6 containers;
`curl.exe -fsS http://127.0.0.1:19090/-/ready` returns `Prometheus Server is Ready.`

- [ ] **Step 4: Commit**

```powershell
git add scripts/demo.ps1
git commit -m "feat(demo): add -Observability switch to the demo runner"
```

## Task 7 — CI: separate PR-blocking observability job

**Files:**
- Modify: `.github/workflows/tinyurl-ci.yml` (new job after `demo-stack`, which ends at line ~108)

**Interfaces:**
- Consumes: `docker-compose.demo.yml` `observability` profile; the same image-build path `demo-stack`
  uses (`up -d --build --wait`, line 94).
- Produces: job id `observability`, `timeout-minutes: 10` (shorter than `demo-stack`'s 20), asserting
  Prometheus reports three `up` targets; always tears down with `down -v --remove-orphans`.

- [ ] **Step 1: Write the job**

Append after the `demo-stack` job's last step (keep the file's `runs-on`/checkout conventions):

```yaml
  observability:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: Checkout
        uses: actions/checkout@v6

      - name: Set up JDK
        uses: actions/setup-java@v6
        with:
          distribution: temurin
          java-version: '17'

      - name: Set up Node
        uses: actions/setup-node@v7
        with:
          node-version: 24

      - name: Build application jars and frontends
        run: |
          npm ci
          ./gradlew :platform:identity:bootJar :platform:shell:bootJar :projects:tinyurl:service:bootJar
          npx nx build shell-host
          npx nx build tinyurl-microfrontend

      # Same reason as demo-stack: CI has no gitignored JWT key, so Docker would create an
      # empty directory at the bind-mount path and identity would fail to boot.
      - name: Generate ephemeral demo JWT key
        run: |
          openssl genpkey -algorithm RSA -out platform/identity/dev-key.pem -pkeyopt rsa_keygen_bits:2048

      - name: Build demo images
        run: |
          docker build -f platform/identity/Dockerfile -t supportfolio/identity:demo .
          docker build -f platform/shell/Dockerfile -t supportfolio/shell:demo .

      - name: Boot observability profile
        run: docker compose -f docker-compose.demo.yml --profile observability up -d --build --wait

      - name: Assert all scrape targets are up
        run: |
          for i in $(seq 1 30); do
            targets=$(curl -fsS http://127.0.0.1:19090/api/v1/targets || true)
            healthy=$(echo "$targets" | jq -r '[.data.activeTargets[] | select(.labels.job | startswith("supportfolio-")) | .health] | unique | join(",")')
            count=$(echo "$targets" | jq -r '[.data.activeTargets[] | select(.labels.job | startswith("supportfolio-"))] | length')
            if [ "$healthy" = "up" ] && [ "$count" = "3" ]; then
              echo "all three targets up"
              exit 0
            fi
            echo "attempt $i: health=$healthy count=$count"
            sleep 5
          done
          echo "::error::Prometheus scrape targets did not converge to 3x up"
          docker compose -f docker-compose.demo.yml logs --tail=200
          exit 1

      - name: Assert grafana is serving the dashboard
        run: |
          curl -fsS http://127.0.0.1:13000/api/health
          curl -fsS "http://127.0.0.1:13000/api/search?query=Supportfolio" | grep -q supportfolio-services

      - name: Dump logs on failure
        if: failure()
        run: docker compose -f docker-compose.demo.yml logs --tail=200

      - name: Tear down
        if: always()
        run: docker compose -f docker-compose.demo.yml --profile observability down -v --remove-orphans
```

- [ ] **Step 2: Validate the YAML locally**

```powershell
npx --yes js-yaml .github/workflows/tinyurl-ci.yml | Out-Null; "yaml ok"
```

Expected: `yaml ok`, exit 0.

- [ ] **Step 3: Dry-run the job body locally (Windows -> bash translation)**

```powershell
docker compose -f docker-compose.demo.yml --profile observability up -d --build --wait
curl.exe -fsS http://127.0.0.1:13000/api/search?query=Supportfolio | Select-String "supportfolio-services"
docker compose -f docker-compose.demo.yml --profile observability down -v --remove-orphans
```

Expected: same assertions pass locally; the GitHub run is the authoritative check (record the job link
in the PR).

- [ ] **Step 4: Commit**

```powershell
git add .github/workflows/tinyurl-ci.yml
git commit -m "ci: add pr-blocking observability profile job"
```

## Task 8 — Roadmap row for the narrowed Plan 6 scope

**Files:**
- Modify: `docs/superpowers/ROADMAP.md` (line 10)

**Interfaces:**
- Consumes: the approved scope reduction in the spec (triage dashboard and "Add new app" dropped).
- Produces: a roadmap row that matches what shipped — no dangling dashboard commitment.

- [ ] **Step 1: Edit the row**

`docs/superpowers/ROADMAP.md:10` currently reads:

```
| 6 - admin-triage | telemetry + triage dashboard, "Add new app" flow | next (not started) |
```

Replace with:

```
| 6 - telemetry | per-service actuator/Prometheus metrics on management ports + observability compose profile; triage dashboard & add-new-app dropped | in progress |
```

- [ ] **Step 2: Verify the edit is the only diff there**

```powershell
git diff --stat docs/superpowers/ROADMAP.md
git diff docs/superpowers/ROADMAP.md
```

Expected: one line changed, one insertion and one deletion; no other row touched.

- [ ] **Step 3: Commit**

```powershell
git add docs/superpowers/ROADMAP.md
git commit -m "docs: narrow plan 6 roadmap row to telemetry scope"
```

## Definition of done

- [ ] `.\gradlew.bat build` green on the final branch state.
- [ ] `npx prettier --check "platform/**/*.{ts,html}" "tools/**/*.ts" "eslint.config.mjs" "jest.config.ts" "jest.preset.js"` green (no new TS touched, but the gate is CI-parity).
- [ ] `docker compose -f docker-compose.demo.yml up -d --wait` healthy **without** the observability profile (inert by default).
- [ ] `docker compose -f docker-compose.demo.yml --profile observability up -d --wait` healthy; three Prometheus targets `up`.
- [ ] No host port published for 9091/9092/9093; `tunnel` profile still proxies only `shell:8080`.
- [ ] `curl.exe -fsS http://localhost:18080/actuator/health` fails (actuator gone from the public port).
- [ ] PR opened against `main` from a feature branch with the observability CI job green.
- [ ] One timestamped, plan-tagged entry added at the top of `docs/superpowers/retrospectives.md`
      answering what went well / what to continue / what to stop (AGENTS.md "Plan retrospective").
