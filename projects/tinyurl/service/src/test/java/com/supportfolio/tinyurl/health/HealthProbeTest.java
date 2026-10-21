package com.supportfolio.tinyurl.health;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.core.env.Environment;
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
      "management.health.db.enabled=true"
    })
class HealthProbeTest {

  @Container @ServiceConnection
  static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:18-alpine");

  @Autowired Environment environment;

  RestClient client() {
    return RestClient.create("http://localhost:" + environment.getProperty("local.server.port"));
  }

  int health(String path) {
    return poll(path).toBodilessEntity().getStatusCode().value();
  }

  String healthBody(String path) {
    return poll(path).body(String.class);
  }

  RestClient.ResponseSpec poll(String path) {
    return client().get().uri(path).retrieve().onStatus(status -> true, (request, response) -> {});
  }

  void awaitStatus(String path, int status, String bodyPart) {
    Duration deadline = Duration.ofSeconds(15);
    long start = System.nanoTime();
    RuntimeException last = null;
    while (Duration.ofNanos(System.nanoTime() - start).compareTo(deadline) < 0) {
      try {
        assertEquals(status, health(path));
        assertEquals(true, healthBody(path).contains(bodyPart));
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

  @Test
  void livenessStaysUpWhileReadinessTurnsDown() {
    awaitStatus("/actuator/health/liveness", 200, "UP");
    awaitStatus("/actuator/health/readiness", 200, "UP");

    POSTGRES.stop();

    awaitStatus("/actuator/health/liveness", 200, "UP");
    awaitStatus("/actuator/health/readiness", 503, "DOWN");
  }
}
