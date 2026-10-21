package com.supportfolio.tinyurl.web;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.params.provider.Arguments.arguments;

import com.supportfolio.tinyurl.PostgresIntegrationTest;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.client.RestClient;

/**
 * Acceptance criterion 5: the anonymous surface is explicit and minimal; everything else is 401.
 */
@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {"spring.web.resources.static-locations=classpath:/test-static/"})
@org.springframework.test.annotation.Commit
class AnonymousSurfaceMatrixTest extends PostgresIntegrationTest {

  static final String SEEDED_SLUG = "matrix123";

  static Stream<Arguments> anonymousSurface() {
    return Stream.of(
        arguments(HttpMethod.GET, "/", 200),
        arguments(HttpMethod.GET, "/signin", 200),
        arguments(HttpMethod.GET, "/auth/callback", 200),
        arguments(HttpMethod.GET, "/main.js", 200),
        arguments(HttpMethod.GET, "/styles.css", 200),
        arguments(HttpMethod.GET, "/remoteEntry.js", 200),
        arguments(HttpMethod.GET, "/api/links", 200),
        arguments(HttpMethod.GET, "/go/" + SEEDED_SLUG, 302),
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

  @Autowired Environment environment;
  @Autowired JdbcTemplate jdbc;

  RestClient client() {
    return RestClient.builder()
        .requestFactory(new JdkClientHttpRequestFactory())
        .baseUrl("http://localhost:" + environment.getProperty("local.server.port"))
        .build();
  }

  @org.junit.jupiter.api.BeforeEach
  void seedsAnEstablishedSlugForTheMatrix() {
    jdbc.update(
        "insert into links (id, slug, target_url, created_by, created_at) values (?, ?, ?, ?, now())"
            + " on conflict (slug) do nothing",
        UUID.randomUUID(),
        SEEDED_SLUG,
        "https://example.com/goal",
        "seeder");
    assertEquals(
        1,
        jdbc.queryForObject(
            "select count(*) from links where slug = ?", Integer.class, SEEDED_SLUG));
  }

  @ParameterizedTest(name = "{0} {1} -> {2}")
  @MethodSource({"anonymousSurface", "protectedSurface"})
  void matchesTheProductionLikeSurface(HttpMethod method, String path, int expected) {
    ResponseEntity<String> response =
        client()
            .method(method)
            .uri(path)
            .retrieve()
            .onStatus(status -> true, (request, r) -> {})
            .toEntity(String.class);
    assertEquals(
        expected,
        response.getStatusCode().value(),
        path + " -> " + response.getStatusCode() + " body " + first(response.getBody()));
  }

  private String first(String body) {
    return body == null ? "" : body.substring(0, Math.min(200, body.length()));
  }
}
