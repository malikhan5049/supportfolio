package com.supportfolio.platform.shell.web;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Map;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.web.client.RestClient;

@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = "spring.web.resources.static-locations=classpath:/test-static/")
class GatewayRoutingTest {

  static MockWebServer mockIdentity = new MockWebServer();
  static MockWebServer mockTinyurl = new MockWebServer();

  @LocalServerPort int port;

  @DynamicPropertySource
  static void upstream(DynamicPropertyRegistry registry) throws Exception {
    mockIdentity.start();
    mockTinyurl.start();
    registry.add(
        "supportfolio.shell.identity-uri",
        () -> "http://localhost:%d".formatted(mockIdentity.getPort()));
    registry.add(
        "supportfolio.shell.tinyurl-uri",
        () -> "http://localhost:%d".formatted(mockTinyurl.getPort()));
  }

  @AfterAll
  static void shutDown() throws Exception {
    mockIdentity.shutdown();
    mockTinyurl.shutdown();
  }

  private RestClient rest() {
    return RestClient.builder().baseUrl("http://localhost:" + port).build();
  }

  @Test
  void forwardsTokenExchangeToIdentityWithBodyAndQueryIntact() throws Exception {
    mockIdentity.enqueue(
        new MockResponse().setResponseCode(200).setBody("{\"accessToken\":\"t\"}"));
    ResponseEntity<String> response =
        rest()
            .post()
            .uri("/api/token")
            .contentType(MediaType.APPLICATION_JSON)
            .body(Map.of("code", "abc"))
            .retrieve()
            .toEntity(String.class);
    assertEquals(200, response.getStatusCode().value());
    var forwarded = mockIdentity.takeRequest();
    assertEquals("/api/token", forwarded.getPath());
    assertTrue(forwarded.getBody().readUtf8().contains("\"code\":\"abc\""));
  }

  @Test
  void forwardsLoginStartWithItsRedirectParam() throws Exception {
    mockIdentity.enqueue(
        new MockResponse()
            .setResponseCode(302)
            .setHeader("Location", "/oauth2/authorization/github"));
    rest()
        .get()
        .uri("/auth/login?redirect=http%3A%2F%2Flocalhost%3A4200%2Fauth%2Fcallback")
        .retrieve()
        .toEntity(String.class);
    assertTrue(mockIdentity.takeRequest().getPath().startsWith("/auth/login?redirect="));
  }

  @Test
  void servesTheSpaShellForClientRoutes() {
    assertTrue(
        rest()
            .get()
            .uri("/signin")
            .retrieve()
            .toEntity(String.class)
            .getBody()
            .contains("shell-test-index"));
  }

  @Test
  void keepsTheSpaCallbackRouteLocal() throws Exception {
    ResponseEntity<String> response =
        rest().get().uri("/auth/callback?code=x").retrieve().toEntity(String.class);
    assertEquals(200, response.getStatusCode().value());
    assertTrue(
        rest()
            .get()
            .uri("/auth/callback?code=x")
            .retrieve()
            .toEntity(String.class)
            .getBody()
            .contains("shell-test-index"));
  }

  @Test
  void forwardsAppApiToTinyurlWithStripPrefix() throws Exception {
    mockTinyurl.enqueue(new MockResponse().setResponseCode(200).setBody("[]"));
    ResponseEntity<String> response =
        rest().get().uri("/apps/tinyurl/api/links").retrieve().toEntity(String.class);
    assertEquals(200, response.getStatusCode().value());
    assertEquals("/api/links", mockTinyurl.takeRequest().getPath());
  }

  @Test
  void forwardsGoRedirectToTinyurl() throws Exception {
    mockTinyurl.enqueue(new MockResponse().setResponseCode(200).setBody("/target"));
    ResponseEntity<String> response = rest().get().uri("/go/abc").retrieve().toEntity(String.class);
    assertEquals(200, response.getStatusCode().value());
    assertEquals("/go/abc", mockTinyurl.takeRequest().getPath());
  }
}
