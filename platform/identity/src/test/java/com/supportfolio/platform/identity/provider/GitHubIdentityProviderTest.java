package com.supportfolio.platform.identity.provider;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.supportfolio.platform.identity.IdentityProperties;
import com.supportfolio.platform.identity.principal.ExternalIdentity;
import java.io.IOException;
import java.util.List;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

class GitHubIdentityProviderTest {

  private MockWebServer gitHubApi;

  @BeforeEach
  void startGitHubApi() throws IOException {
    gitHubApi = new MockWebServer();
    gitHubApi.start();
  }

  @AfterEach
  void shutDownGitHubApi() throws IOException {
    gitHubApi.shutdown();
  }

  @Test
  void normalizesGitHubUserIntoExternalIdentity() throws InterruptedException {
    gitHubApi.enqueue(json("{\"id\":123,\"login\":\"octocat\",\"name\":\"The Octocat\"}"));
    gitHubApi.enqueue(
        json(
            "[{\"email\":\"a@x.com\",\"primary\":true,\"verified\":true,\"visibility\":\"private\"}]"));

    ExternalIdentity id = provider().fetch("gh-token");

    assertEquals(new ExternalIdentity("123", "octocat", "a@x.com", "The Octocat"), id);
    RecordedRequest userRequest = gitHubApi.takeRequest();
    RecordedRequest emailsRequest = gitHubApi.takeRequest();
    assertEquals("/user", userRequest.getPath());
    assertEquals("/user/emails", emailsRequest.getPath());
    assertEquals("Bearer gh-token", userRequest.getHeader("Authorization"));
    assertEquals("Bearer gh-token", emailsRequest.getHeader("Authorization"));
    assertEquals("application/vnd.github+json", userRequest.getHeader("Accept"));
    assertEquals("application/vnd.github+json", emailsRequest.getHeader("Accept"));
  }

  @Test
  void picksTheFirstVerifiedPrimaryEmail() {
    gitHubApi.enqueue(json("{\"id\":1,\"login\":\"octocat\",\"name\":\"The Octocat\"}"));
    gitHubApi.enqueue(
        json(
            "[{\"email\":\"x@example.com\",\"primary\":false,\"verified\":true},"
                + "{\"email\":\"y@example.com\",\"primary\":true,\"verified\":true}]"));

    ExternalIdentity id = provider().fetch("gh-token");

    assertEquals("y@example.com", id.email());
  }

  @Test
  void fallsBackToNullEmailWhenNoVerifiedPrimaryEmailExists() {
    gitHubApi.enqueue(json("{\"id\":1,\"login\":\"octocat\",\"name\":\"The Octocat\"}"));
    gitHubApi.enqueue(json("[{\"email\":\"b@x.com\",\"primary\":false,\"verified\":false}]"));

    ExternalIdentity id = provider().fetch("gh-token");

    assertNull(id.email());
  }

  @Test
  void displaysNameFallbackToLoginWhenNameIsNull() {
    gitHubApi.enqueue(json("{\"id\":9,\"login\":\"octocat\",\"name\":null}"));
    gitHubApi.enqueue(json("[]"));

    ExternalIdentity id = provider().fetch("gh-token");

    assertEquals(new ExternalIdentity("9", "octocat", null, "octocat"), id);
  }

  @Test
  void propagatesUnauthorizedAsIllegalStateException() {
    gitHubApi.enqueue(new MockResponse().setResponseCode(401));

    IllegalStateException failure =
        assertThrows(IllegalStateException.class, () -> provider().fetch("gh-token"));

    assertFalse(failure.getMessage().contains("gh-token"));
  }

  private GitHubIdentityProvider provider() {
    // On this machine MockWebServer's url() host is reverse-DNS derived and resolves to a
    // blackholed address (host.docker.internal -> 192.168.0.160), so pin the literal
    // loopback host while keeping the mock server's actual port.
    String baseUrl = "http://localhost:" + gitHubApi.getPort();
    IdentityProperties identityProperties =
        new IdentityProperties(
            "http://localhost:8081",
            "owner-login",
            List.of("friend-login"),
            List.of("http://localhost:4200"),
            null,
            baseUrl,
            60,
            3600);
    return new GitHubIdentityProvider(RestClient.builder(), identityProperties);
  }

  private static MockResponse json(String body) {
    return new MockResponse().setHeader("Content-Type", "application/json").setBody(body);
  }
}
