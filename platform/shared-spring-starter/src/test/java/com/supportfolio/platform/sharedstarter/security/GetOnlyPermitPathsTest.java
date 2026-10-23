package com.supportfolio.platform.sharedstarter.security;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

@SpringBootTest(
    classes = {
      IdentityResourceServerAutoConfiguration.class,
      GetOnlyPermitPathsTest.Endpoints.class
    },
    properties = {
      "supportfolio.security.resource-server.enabled=true",
      "supportfolio.security.jwk-set-uri=http://localhost:8081/oauth2/jwks",
      "supportfolio.security.issuer-uri=http://localhost:8081",
      "supportfolio.security.permit-get-paths=/get-only/items",
      "supportfolio.security.csrf-ignore-paths=/get-only/items"
    })
@AutoConfigureMockMvc
class GetOnlyPermitPathsTest {

  @Autowired MockMvc mockMvc;

  @Test
  void permitGetPathsAllowsAnonymousGet() throws Exception {
    mockMvc.perform(get("/get-only/items")).andExpect(status().isOk());
  }

  @Test
  void permitGetPathsDoesNotAllowAnonymousPost() throws Exception {
    mockMvc.perform(post("/get-only/items")).andExpect(status().isUnauthorized());
  }

  @RestController
  static class Endpoints {

    @GetMapping("/get-only/items")
    String getItems() {
      return "items";
    }

    @PostMapping("/get-only/items")
    String postItems() {
      return "created";
    }
  }
}
