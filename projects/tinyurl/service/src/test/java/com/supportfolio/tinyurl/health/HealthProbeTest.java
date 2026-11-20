package com.supportfolio.tinyurl.health;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalManagementPort;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.web.client.RestClient;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Its own container (not the shared PostgresIntegrationTest base): this class stops the container
 * on purpose, and a shared context cache must not outlive it.
 */
@Testcontainers
@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
      "spring.datasource.hikari.connection-timeout=1000",
      "management.health.db.enabled=true",
      "management.server.port=0"
    })
class HealthProbeTest {

  private static final Duration HTTP_TIMEOUT = Duration.ofSeconds(10);

  private static final HttpClient HTTP =
      HttpClient.newBuilder().connectTimeout(HTTP_TIMEOUT).build();

  @Container @ServiceConnection
  static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:18-alpine");

  @LocalServerPort private int port;

  @LocalManagementPort private int managementPort;

  private String managementUrl(String path) {
    return "http://localhost:" + managementPort + path;
  }

  RestClient client() {
    return RestClient.create();
  }

  int health(String url) {
    return poll(url).toBodilessEntity().getStatusCode().value();
  }

  String healthBody(String url) {
    return poll(url).body(String.class);
  }

  RestClient.ResponseSpec poll(String url) {
    return client().get().uri(url).retrieve().onStatus(status -> true, (request, response) -> {});
  }

  void awaitStatus(String url, int status, String bodyPart) {
    Duration deadline = Duration.ofSeconds(15);
    long start = System.nanoTime();
    RuntimeException last = null;
    while (Duration.ofNanos(System.nanoTime() - start).compareTo(deadline) < 0) {
      try {
        assertEquals(status, health(url));
        assertEquals(true, healthBody(url).contains(bodyPart));
        return;
      } catch (RuntimeException e) {
        last = e;
        try {
          Thread.sleep(500);
        } catch (InterruptedException interrupted) {
          Thread.currentThread().interrupt();
          throw new IllegalStateException(interrupted);
        }
      }
    }
    if (last == null) {
      throw new AssertionError("timeout without last error");
    }
    throw last;
  }

  HttpResponse<String> get(String url) throws IOException, InterruptedException {
    HttpRequest request =
        HttpRequest.newBuilder(URI.create(url)).timeout(HTTP_TIMEOUT).GET().build();
    return HTTP.send(request, HttpResponse.BodyHandlers.ofString());
  }

  @Test
  void livenessStaysUpWhileReadinessTurnsDown() {
    awaitStatus(managementUrl("/actuator/health/liveness"), 200, "UP");
    awaitStatus(managementUrl("/actuator/health/readiness"), 200, "UP");

    POSTGRES.stop();

    awaitStatus(managementUrl("/actuator/health/liveness"), 200, "UP");
    awaitStatus(managementUrl("/actuator/health/readiness"), 503, "DOWN");
  }

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

    // Security entry point answers unknown anonymous paths with 401/403/404 — never 200.
    assertThat(response.statusCode()).isIn(401, 403, 404);
    assertThat(response.body()).doesNotContain("jvm_memory_used_bytes");
  }
}
