package com.supportfolio.tinyurl.web;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.supportfolio.tinyurl.PostgresIntegrationTest;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.web.client.RestClient;

@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = "spring.web.resources.static-locations=classpath:/test-static/")
class GatewayRoutingTest extends PostgresIntegrationTest {

  private static final MockWebServer MOCK_IDENTITY = new MockWebServer();

  @LocalServerPort int port;

  @DynamicPropertySource
  static void identity(DynamicPropertyRegistry registry) throws Exception {
    MOCK_IDENTITY.start();
    registry.add(
        "supportfolio.tinyurl.identity-uri",
        () -> "http://localhost:%d".formatted(MOCK_IDENTITY.getPort()));
  }

  @AfterAll
  static void shutdownIdentity() throws Exception {
    MOCK_IDENTITY.shutdown();
  }

  private RestClient rest() {
    return RestClient.builder().baseUrl("http://localhost:" + port).build();
  }

  @Test
  void forwardsTokenExchangeWithBodyIntact() throws Exception {
    MOCK_IDENTITY.enqueue(new MockResponse().setResponseCode(200).setBody("token"));

    String response =
        rest()
            .post()
            .uri("/api/token")
            .contentType(MediaType.APPLICATION_JSON)
            .body(Map.of("code", "abc"))
            .retrieve()
            .body(String.class);

    assertEquals("token", response);
    RecordedRequest forwarded = MOCK_IDENTITY.takeRequest();
    assertEquals("/api/token", forwarded.getPath());
    assertTrue(forwarded.getBody().readUtf8().contains("\"code\":\"abc\""));
  }

  @Test
  void forwardsLoginStartWithItsRedirectParam() throws Exception {
    MOCK_IDENTITY.enqueue(new MockResponse().setResponseCode(200).setBody("login"));

    rest()
        .get()
        .uri("/auth/login?redirect=http%3A%2F%2Flocalhost%3A4201%2Fauth%2Fcallback")
        .retrieve()
        .body(String.class);

    assertTrue(MOCK_IDENTITY.takeRequest().getPath().startsWith("/auth/login?redirect="));
  }

  @Test
  void forwardsJwksAndLoginCallbackPaths() throws Exception {
    MOCK_IDENTITY.enqueue(new MockResponse().setResponseCode(200).setBody("jwks"));
    MOCK_IDENTITY.enqueue(new MockResponse().setResponseCode(200).setBody("callback"));

    assertEquals("jwks", rest().get().uri("/oauth2/jwks").retrieve().body(String.class));
    assertEquals(
        "callback",
        rest().get().uri("/login/oauth2/code/github?code=abc").retrieve().body(String.class));

    assertEquals("/oauth2/jwks", MOCK_IDENTITY.takeRequest().getPath());
    assertEquals("/login/oauth2/code/github?code=abc", MOCK_IDENTITY.takeRequest().getPath());
  }

  @Test
  void servesTheSpaForRootSigninAndCallback() throws Exception {
    assertTrue(get("/").contains("tinyurl-test-index"));
    assertTrue(get("/signin").contains("tinyurl-test-index"));
    assertTrue(get("/auth/callback").contains("tinyurl-test-index"));
    assertNull(MOCK_IDENTITY.takeRequest(100, TimeUnit.MILLISECONDS));
  }

  private String get(String path) {
    return rest().get().uri(path).retrieve().body(String.class);
  }
}
