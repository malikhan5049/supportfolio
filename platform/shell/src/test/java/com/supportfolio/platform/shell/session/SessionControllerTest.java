package com.supportfolio.platform.shell.session;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(
    properties = {
      "supportfolio.security.resource-server.enabled=true",
      "supportfolio.security.jwk-set-uri=http://localhost:8081/oauth2/jwks",
      "supportfolio.security.issuer-uri=http://localhost:8081"
    })
@AutoConfigureMockMvc
class SessionControllerTest {

  @Autowired MockMvc mockMvc;

  @Test
  void returnsClaimsFromTheValidatedJwt() throws Exception {
    mockMvc
        .perform(
            get("/api/session/me")
                .with(
                    jwt()
                        .jwt(
                            token ->
                                token
                                    .subject("123")
                                    .claim("preferred_username", "octocat")
                                    .claim("role", "user"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value("123"))
        .andExpect(jsonPath("$.login").value("octocat"))
        .andExpect(jsonPath("$.role").value("user"));
  }

  @Test
  void rejectsAnonymousRequests() throws Exception {
    mockMvc.perform(get("/api/session/me")).andExpect(status().isUnauthorized());
  }
}
