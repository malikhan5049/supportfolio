package com.supportfolio.platform.sharedstarter.security;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

@SpringBootTest(
    classes = {
      IdentityResourceServerAutoConfiguration.class,
      PublicPathsSecurityTest.Endpoints.class
    },
    properties = {
      "supportfolio.security.resource-server.enabled=true",
      "supportfolio.security.jwk-set-uri=http://localhost:8081/oauth2/jwks",
      "supportfolio.security.issuer-uri=http://localhost:8081",
      "supportfolio.security.permit-paths=/public/**",
      "supportfolio.security.csrf-ignore-paths=/public/echo"
    })
@AutoConfigureMockMvc
class PublicPathsSecurityTest {

  @Autowired MockMvc mockMvc;

  @Test
  void permitPathsAllowAnonymousRequests() throws Exception {
    mockMvc.perform(get("/public/ping")).andExpect(status().isOk());
  }

  @Test
  void unlistedPathsStillRequireAuthentication() throws Exception {
    mockMvc.perform(get("/private/ping")).andExpect(status().isUnauthorized());
  }

  @Test
  void csrfIgnorePathsAllowAnonymousPost() throws Exception {
    mockMvc.perform(post("/public/echo")).andExpect(status().isOk());
  }

  @Test
  void unlistedPostsStillRequireCsrfToken() throws Exception {
    mockMvc
        .perform(post("/private/echo"))
        .andExpect(status().isForbidden());
  }

  @RestController
  static class Endpoints {

    @GetMapping("/public/ping")
    String ping() {
      return "pong";
    }

    @GetMapping("/private/ping")
    String privatePing() {
      return "secret";
    }

    @PostMapping("/public/echo")
    String echo() {
      return "echo";
    }

    @PostMapping("/private/echo")
    String privateEcho() {
      return "echo";
    }
  }
}
