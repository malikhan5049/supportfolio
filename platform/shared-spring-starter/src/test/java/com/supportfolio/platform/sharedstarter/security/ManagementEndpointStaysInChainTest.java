package com.supportfolio.platform.sharedstarter.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

/**
 * Branch (a) of the conditional actuator exclusion: with no {@code management.server.port} the
 * management server is the main server, so actuator endpoint requests stay inside the security
 * chain and must not be served anonymously.
 */
@SpringBootTest(
    classes = SecurityChainTestApplication.class,
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
      "supportfolio.security.resource-server.enabled=true",
      "supportfolio.security.jwk-set-uri=http://localhost:8081/oauth2/jwks",
      "supportfolio.security.issuer-uri=http://localhost:8081"
    })
class ManagementEndpointStaysInChainTest {

  private static final Duration HTTP_TIMEOUT = Duration.ofSeconds(10);

  private static final HttpClient HTTP =
      HttpClient.newBuilder().connectTimeout(HTTP_TIMEOUT).build();

  @LocalServerPort private int appPort;

  @Test
  void actuatorEndpointIsNotServedAnonymouslyOnMainPort() throws Exception {
    HttpResponse<String> response = get(appPort, "/actuator/health");

    // The chain matches actuator requests here, so the anonymous caller is challenged.
    assertThat(response.statusCode()).isEqualTo(401);
    assertThat(response.body()).doesNotContain("\"status\":\"UP\"");
  }

  private static HttpResponse<String> get(int port, String path)
      throws IOException, InterruptedException {
    HttpRequest request =
        HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
            .timeout(HTTP_TIMEOUT)
            .GET()
            .build();
    return HTTP.send(request, HttpResponse.BodyHandlers.ofString());
  }
}
