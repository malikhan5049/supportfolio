package com.supportfolio.tinyurl.web;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.params.provider.Arguments.arguments;

import com.supportfolio.tinyurl.PostgresIntegrationTest;
import com.supportfolio.tinyurl.link.LinkEntity;
import com.supportfolio.tinyurl.link.LinkRepository;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Instant;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpMethod;

@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = "spring.web.resources.static-locations=classpath:/test-static/")
class AnonymousSurfaceMatrixTest extends PostgresIntegrationTest {

  private final HttpClient http =
      HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NEVER).build();

  @Autowired LinkRepository links;
  @LocalServerPort int port;
  private String seededSlug;

  static Stream<Arguments> anonymousSurface() {
    return Stream.of(
        arguments(HttpMethod.GET, "/", 200),
        arguments(HttpMethod.GET, "/signin", 200),
        arguments(HttpMethod.GET, "/auth/callback", 200),
        arguments(HttpMethod.GET, "/main.js", 200),
        arguments(HttpMethod.GET, "/styles.css", 200),
        arguments(HttpMethod.GET, "/remoteEntry.js", 200),
        arguments(HttpMethod.GET, "/api/links", 200),
        arguments(HttpMethod.GET, "/go/{slug}", 302),
        arguments(HttpMethod.GET, "/actuator/health", 200),
        arguments(HttpMethod.GET, "/actuator/health/liveness", 200),
        arguments(HttpMethod.GET, "/actuator/health/readiness", 200),
        arguments(HttpMethod.GET, "/v3/api-docs", 200),
        arguments(HttpMethod.GET, "/swagger-ui/index.html", 200));
  }

  static Stream<Arguments> protectedSurface() {
    return Stream.of(
        arguments(HttpMethod.POST, "/api/links", 401),
        arguments(HttpMethod.GET, "/api/links/1", 401),
        arguments(HttpMethod.GET, "/actuator/env", 401),
        arguments(HttpMethod.GET, "/api/anything", 401));
  }

  @BeforeEach
  void seedLink() {
    seededSlug = UUID.randomUUID().toString().substring(0, 8);
    links.saveAndFlush(
        new LinkEntity(
            UUID.randomUUID(),
            seededSlug,
            "https://example.com/matrix",
            "matrix-user",
            Instant.parse("2026-10-22T00:00:00Z")));
  }

  @ParameterizedTest(name = "{0} {1} -> {2}")
  @MethodSource({"anonymousSurface", "protectedSurface"})
  void matchesTheProductionLikeSurface(HttpMethod method, String path, int expected)
      throws Exception {
    String resolvedPath = path.replace("{slug}", seededSlug);
    HttpRequest.Builder request =
        HttpRequest.newBuilder(URI.create("http://localhost:" + port + resolvedPath));
    if (method == HttpMethod.POST) {
      request.header("Content-Type", "application/json");
      request.POST(HttpRequest.BodyPublishers.ofString("{\"targetUrl\":\"https://example.com\"}"));
    } else {
      request.GET();
    }

    HttpResponse<String> response =
        http.send(request.build(), HttpResponse.BodyHandlers.ofString());
    assertEquals(expected, response.statusCode());
  }
}
