package com.supportfolio.tinyurl.health;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.fail;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

@Testcontainers
@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
      "spring.datasource.hikari.connection-timeout=1000",
      "management.health.db.enabled=true"
    })
class HealthProbeTest {

  @Container @ServiceConnection
  static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:18.6-bookworm");

  private final HttpClient http = HttpClient.newHttpClient();

  @LocalServerPort int port;

  @Test
  void livenessStaysUpWhileReadinessTurnsDown() throws Exception {
    assertEquals(200, health("/actuator/health/liveness").statusCode());
    assertEquals(200, health("/actuator/health/readiness").statusCode());

    POSTGRES.stop();

    awaitStatus("/actuator/health/liveness", 200, "UP");
    awaitStatus("/actuator/health/readiness", 503, "DOWN");
  }

  private HttpResponse<String> health(String path) throws Exception {
    return http.send(
        HttpRequest.newBuilder(URI.create("http://localhost:" + port + path)).GET().build(),
        HttpResponse.BodyHandlers.ofString());
  }

  private void awaitStatus(String path, int statusCode, String status) throws Exception {
    long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(15);
    HttpResponse<String> response;
    do {
      response = health(path);
      if (response.statusCode() == statusCode && response.body().contains(status)) {
        return;
      }
      Thread.sleep(500);
    } while (System.nanoTime() < deadline);
    fail("Expected " + path + " to return " + statusCode + " with " + status + ", got " + response);
  }
}
