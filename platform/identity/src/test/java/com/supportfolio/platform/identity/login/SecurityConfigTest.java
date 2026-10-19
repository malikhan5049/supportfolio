package com.supportfolio.platform.identity.login;

import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.util.Base64;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest(
    properties = {
      "spring.security.oauth2.client.registration.github.client-id=test",
      "spring.security.oauth2.client.registration.github.client-secret=test"
    })
class SecurityConfigTest {

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

  @Autowired private WebApplicationContext context;

  private MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
  }

  @Test
  void unknownEndpointNeverReachesAnUnprotectedController() throws Exception {
    int status =
        mockMvc
            .perform(get("/definitely-not-a-real-endpoint"))
            .andReturn()
            .getResponse()
            .getStatus();
    boolean acceptable = (status >= 300 && status < 400) || status == 401;
    assertTrue(acceptable, "expected a 3xx redirect or 401 but the status was " + status);
    assertNotEquals(404, status);
    assertNotEquals(500, status);
  }

  @Test
  void jwksEndpointStaysPublic() throws Exception {
    mockMvc.perform(get("/oauth2/jwks")).andExpect(status().isOk());
  }

  @Test
  void nonAllowlistedRedirectIsRejectedBeforeTheGithubDanceStarts() throws Exception {
    mockMvc
        .perform(get("/auth/login").param("redirect", "https://evil.example.com/hook"))
        .andExpect(status().isBadRequest());
  }

  @Test
  void allowlistedRedirectStoresTheTargetAndStartsTheGithubDance() throws Exception {
    mockMvc
        .perform(get("/auth/login").param("redirect", "http://localhost:4200/home"))
        .andExpect(status().isFound())
        .andExpect(header().string("Location", "/oauth2/authorization/github"))
        .andExpect(
            request()
                .sessionAttribute(
                    LoginRedirectController.REDIRECT_ATTRIBUTE, "http://localhost:4200/home"));
  }

  private static String pem(PrivateKey privateKey) {
    String body =
        Base64.getMimeEncoder(64, new byte[] {'\n'}).encodeToString(privateKey.getEncoded());
    return "-----BEGIN PRIVATE KEY-----\n" + body + "\n-----END PRIVATE KEY-----\n";
  }
}
