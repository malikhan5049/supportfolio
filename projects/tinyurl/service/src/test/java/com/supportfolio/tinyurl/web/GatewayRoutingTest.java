package com.supportfolio.tinyurl.web;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.supportfolio.tinyurl.PostgresIntegrationTest;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.web.client.RestClient;

/** Same-origin surface: the four Identity browser endpoints proxy out, SPA paths serve locally. */
@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = "spring.web.resources.static-locations=classpath:/test-static/")
class GatewayRoutingTest extends PostgresIntegrationTest {

  static final MockWebServer IDENTITY = new MockWebServer();

  @DynamicPropertySource
  static void identityUri(DynamicPropertyRegistry registry) throws Exception {
    IDENTITY.start();
    registry.add(
        "supportfolio.tinyurl.identity-uri", () -> "http://localhost:" + IDENTITY.getPort());
  }

  @AfterAll
  static void stopIdentity() throws Exception {
    IDENTITY.shutdown();
  }

  @Autowired RestClient.Builder rest;
  @Autowired Environment environment;

  RestClient client() {
    return rest.baseUrl("http://localhost:" + environment.getProperty("local.server.port")).build();
  }

  @Test
  void forwardsTokenExchangeWithBodyIntact() throws Exception {
    IDENTITY.enqueue(new MockResponse().setBody("{\"accessToken\":\"t\"}"));
    String response =
        client()
            .post()
            .uri("/api/token")
            .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
            .body(java.util.Map.of("code", "abc"))
            .retrieve()
            .body(String.class);

    assertEquals("{\"accessToken\":\"t\"}", response);
    RecordedRequest seen = IDENTITY.takeRequest();
    assertEquals("/api/token", seen.getPath());
    assertEquals("{\"code\":\"abc\"}", seen.getBody().readUtf8());
  }

  @Test
  void forwardsLoginStartWithItsRedirectParam() throws Exception {
    IDENTITY.enqueue(new MockResponse().setBody("login-html"));
    String response =
        client()
            .get()
            .uri("/auth/login?redirect=http://localhost:4201/auth/callback")
            .retrieve()
            .body(String.class);

    assertEquals("login-html", response);
    RecordedRequest seen = IDENTITY.takeRequest();
    assertEquals(
        "/auth/login?redirect=http://localhost:4201/auth/callback",
        java.net.URLDecoder.decode(seen.getPath(), java.nio.charset.StandardCharsets.UTF_8));
  }

  @Test
  void forwardsJwksAndLoginCallbackPaths() throws Exception {
    IDENTITY.enqueue(new MockResponse().setBody("{ \"keys\": [] }"));
    assertEquals(
        "{ \"keys\": [] }", client().get().uri("/oauth2/jwks").retrieve().body(String.class));
    RecordedRequest seen = IDENTITY.takeRequest();
    assertEquals("/oauth2/jwks", seen.getPath());

    IDENTITY.enqueue(new MockResponse().setBody("cb"));
    assertEquals(
        "cb", client().get().uri("/login/oauth2/code/github").retrieve().body(String.class));
    RecordedRequest seen2 = IDENTITY.takeRequest();
    assertEquals("/login/oauth2/code/github", seen2.getPath());
  }

  @Test
  void servesTheSpaForRootSigninAndCallback() {
    long proxiedBefore = IDENTITY.getRequestCount();
    for (String path : new String[] {"/", "/signin", "/auth/callback"}) {
      String body = client().get().uri(path).retrieve().body(String.class);
      assertTrue(body.contains("tinyurl-test-index"), path + " must serve the SPA");
    }
    assertEquals(proxiedBefore, IDENTITY.getRequestCount());
  }
}
