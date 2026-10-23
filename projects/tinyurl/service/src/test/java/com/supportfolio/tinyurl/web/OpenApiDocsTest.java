package com.supportfolio.tinyurl.web;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.supportfolio.tinyurl.PostgresIntegrationTest;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class OpenApiDocsTest extends PostgresIntegrationTest {

  private final HttpClient http = HttpClient.newHttpClient();

  @LocalServerPort int port;

  @Test
  void servesTheOpenApiDocumentAndUiAnonymously() throws Exception {
    HttpResponse<String> docs = get("/v3/api-docs");

    assertEquals(200, docs.statusCode());
    assertTrue(docs.body().contains("\"title\":\"TinyURL API\""));
    assertTrue(docs.body().contains("\"version\":\"1.0.0\""));
    assertTrue(docs.body().contains("\"/api/links\""));
    assertTrue(docs.body().contains("\"/go/{slug}\""));
    assertEquals(200, get("/swagger-ui/index.html").statusCode());
  }

  private HttpResponse<String> get(String path) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder(URI.create("http://localhost:" + port + path)).GET().build();
    return http.send(request, HttpResponse.BodyHandlers.ofString());
  }
}
