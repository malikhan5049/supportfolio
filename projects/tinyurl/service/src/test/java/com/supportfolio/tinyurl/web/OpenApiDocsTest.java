package com.supportfolio.tinyurl.web;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.supportfolio.tinyurl.PostgresIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestClient;

/** OpenAPI is published from the running service and reachable anonymously. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class OpenApiDocsTest extends PostgresIntegrationTest {

  @Autowired RestClient.Builder rest;
  @Autowired Environment environment;

  RestClient client() {
    return rest.baseUrl("http://localhost:" + environment.getProperty("local.server.port")).build();
  }

  @Test
  void servesTheOpenApiDocumentAndUiAnonymously() {
    ResponseEntity<String> docs =
        client().get().uri("/v3/api-docs").retrieve().toEntity(String.class);
    assertEquals(200, docs.getStatusCode().value());
    assertTrue(docs.getBody().contains("\"/api/links\""));
    assertTrue(docs.getBody().contains("\"/go/{slug}\""));
    assertEquals(
        200,
        client()
            .get()
            .uri("/swagger-ui/index.html")
            .retrieve()
            .toEntity(String.class)
            .getStatusCode()
            .value());
  }
}
