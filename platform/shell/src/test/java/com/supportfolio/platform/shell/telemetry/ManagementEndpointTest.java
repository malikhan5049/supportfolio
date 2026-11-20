package com.supportfolio.platform.shell.telemetry;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalManagementPort;
import org.springframework.boot.test.web.server.LocalServerPort;

// Same property block as GatewayRoutingTest, plus a random management port.
@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
      "spring.web.resources.static-locations=classpath:/test-static/",
      "management.server.port=0"
    })
class ManagementEndpointTest {

  private static final Duration HTTP_TIMEOUT = Duration.ofSeconds(10);

  private static final HttpClient HTTP =
      HttpClient.newBuilder().connectTimeout(HTTP_TIMEOUT).build();

  @LocalServerPort private int appPort;

  @LocalManagementPort private int managementPort;

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
  void prometheusIsServedOnManagementPort() throws Exception {
    HttpResponse<String> response = get(managementPort, "/actuator/prometheus");

    assertThat(response.statusCode()).isEqualTo(200);
    assertThat(response.headers().firstValue("Content-Type")).isPresent();
    assertThat(response.body()).contains("jvm_memory_used_bytes");
    assertThat(response.body()).contains("application=\"shell\"");
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
}
