package com.supportfolio.platform.shell.web;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestClient;

@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = "supportfolio.shell.demo-login-enabled=true")
class FeaturesControllerTest {

  @LocalServerPort int port;

  private RestClient rest() {
    return RestClient.builder().baseUrl("http://localhost:" + port).build();
  }

  @Test
  void reportsDemoLogin() {
    ResponseEntity<String> response =
        rest().get().uri("/api/features").retrieve().toEntity(String.class);
    assertEquals(200, response.getStatusCode().value());
    assertTrue(response.getBody().contains("\"demoLogin\":true"));
  }
}
