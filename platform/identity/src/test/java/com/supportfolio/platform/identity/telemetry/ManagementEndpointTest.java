package com.supportfolio.platform.identity.telemetry;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.time.Duration;
import java.util.Base64;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalManagementPort;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

// Same property block as IdentityFlowIntegrationTest, plus a random management port.
@SpringBootTest(
    properties = {
      "spring.security.oauth2.client.registration.github.client-id=test-client",
      "spring.security.oauth2.client.registration.github.client-secret=test-secret",
      "management.server.port=0"
    },
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ManagementEndpointTest {

  private static final Duration HTTP_TIMEOUT = Duration.ofSeconds(10);

  private static final HttpClient HTTP =
      HttpClient.newBuilder().connectTimeout(HTTP_TIMEOUT).build();

  @LocalServerPort private int appPort;

  @LocalManagementPort private int managementPort;

  @DynamicPropertySource
  static void identityProperties(DynamicPropertyRegistry registry) throws Exception {
    KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
    generator.initialize(2048);
    KeyPair keyPair = generator.generateKeyPair();
    registry.add("supportfolio.identity.issuer", () -> "http://localhost:8081");
    registry.add("supportfolio.identity.admin-login", () -> "owner");
    registry.add("supportfolio.identity.allowlist", () -> "friend");
    registry.add("supportfolio.identity.redirect-origins", () -> "http://localhost:4200");
    registry.add("supportfolio.identity.jwt-private-key-pem", () -> pem(keyPair.getPrivate()));
  }

  @Test
  void managementPortIsSeparateFromMainPort() {
    assertThat(managementPort).isNotEqualTo(appPort);
  }

  @Test
  void healthIsServedOnManagementPort() throws Exception {
    HttpResponse<String> response = get(managementPort, "/actuator/health");

    assertThat(response.statusCode()).isEqualTo(200);
    assertThat(response.body()).contains("\"status\":\"UP\"");
  }

  @Test
  void healthGroupsAreServedOnManagementPort() throws Exception {
    for (String group : new String[] {"liveness", "readiness"}) {
      HttpResponse<String> response = get(managementPort, "/actuator/health/" + group);

      assertThat(response.statusCode()).as(group).isEqualTo(200);
      assertThat(response.body()).as(group).contains("\"status\":\"UP\"");
    }
  }

  @Test
  void prometheusIsServedOnManagementPort() throws Exception {
    HttpResponse<String> response = get(managementPort, "/actuator/prometheus");

    assertThat(response.statusCode()).isEqualTo(200);
    assertThat(response.headers().firstValue("Content-Type")).isPresent();
    assertThat(response.body()).contains("jvm_memory_used_bytes");
    assertThat(response.body()).contains("application=\"identity\"");
  }

  @Test
  void prometheusIsNotServedOnMainPort() throws Exception {
    HttpResponse<String> response = get(appPort, "/actuator/prometheus");

    // Security entry point answers unknown anonymous paths with 401/403/404 — never 200.
    assertThat(response.statusCode()).isIn(401, 403, 404);
    assertThat(response.body()).doesNotContain("jvm_memory_used_bytes");
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

  private static String pem(PrivateKey privateKey) {
    String body =
        Base64.getMimeEncoder(64, new byte[] {'\n'}).encodeToString(privateKey.getEncoded());
    return "-----BEGIN PRIVATE KEY-----\n" + body + "\n-----END PRIVATE KEY-----\n";
  }
}
