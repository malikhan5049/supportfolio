package com.supportfolio.platform.identity.token;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.nimbusds.jwt.SignedJWT;
import com.supportfolio.platform.identity.IdentityProperties;
import com.supportfolio.platform.identity.principal.IdentityRole;
import com.supportfolio.platform.identity.principal.InternalPrincipal;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.util.Base64;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
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
class TokenControllerTest {

  /** Unknown, used, and expired codes share one body so replay probing learns nothing. */
  private static final String INVALID_CODE_BODY = "{\"error\":\"invalid_code\"}";

  private static final InternalPrincipal PRINCIPAL =
      new InternalPrincipal(
          "42", "octocat", "octocat@github.test", "The Octocat", IdentityRole.USER);

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
  @Autowired private OneTimeCodeStore oneTimeCodeStore;

  private MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
  }

  @Test
  void validCodeReturnsTokenContract() throws Exception {
    String code = oneTimeCodeStore.create(PRINCIPAL);

    String body =
        mockMvc
            .perform(
                post("/api/token")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(exchangeRequest(code)))
            .andExpect(status().isOk())
            .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
            .andExpect(jsonPath("$.tokenType").value("Bearer"))
            .andExpect(jsonPath("$.expiresIn").value(3600))
            .andExpect(jsonPath("$.principal.id").value("42"))
            .andExpect(jsonPath("$.principal.login").value("octocat"))
            .andExpect(jsonPath("$.principal.email").value("octocat@github.test"))
            .andExpect(jsonPath("$.principal.displayName").value("The Octocat"))
            .andExpect(jsonPath("$.principal.role").value("user"))
            .andReturn()
            .getResponse()
            .getContentAsString(StandardCharsets.UTF_8);

    // The access token is a real compact JWT, not a placeholder.
    String accessToken = JsonPath.read(body, "$.accessToken");
    assertFalse(accessToken.isBlank());
    SignedJWT.parse(accessToken);
  }

  @Test
  void usedCodeIsRejectedOnReplay() throws Exception {
    String code = oneTimeCodeStore.create(PRINCIPAL);

    mockMvc
        .perform(
            post("/api/token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(exchangeRequest(code)))
        .andExpect(status().isOk());

    mockMvc
        .perform(
            post("/api/token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(exchangeRequest(code)))
        .andExpect(status().isBadRequest())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
        .andExpect(content().string(INVALID_CODE_BODY));
  }

  @Test
  void expiredCodeIsRejected() throws Exception {
    IdentityProperties zeroTtl =
        new IdentityProperties(
            "http://localhost:8081",
            "owner",
            List.of("friend"),
            List.of("http://localhost:4200"),
            "unused",
            "https://api.github.com",
            0,
            3600);
    // A code minted with a zero TTL is already dead on arrival; the endpoint must answer with
    // the same uniform error it gives for an unknown code, since expired is indistinguishable
    // from unknown in the store.
    String expiredCode = new OneTimeCodeStore(zeroTtl).create(PRINCIPAL);

    mockMvc
        .perform(
            post("/api/token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(exchangeRequest(expiredCode)))
        .andExpect(status().isBadRequest())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
        .andExpect(content().string(INVALID_CODE_BODY));
  }

  @Test
  void unknownCodeIsRejected() throws Exception {
    mockMvc
        .perform(
            post("/api/token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(exchangeRequest("definitely-not-a-real-code")))
        .andExpect(status().isBadRequest())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
        .andExpect(content().string(INVALID_CODE_BODY));
  }

  private static String exchangeRequest(String code) {
    return "{\"code\":\"" + code + "\"}";
  }

  private static String pem(PrivateKey privateKey) {
    String body =
        Base64.getMimeEncoder(64, new byte[] {'\n'}).encodeToString(privateKey.getEncoded());
    return "-----BEGIN PRIVATE KEY-----\n" + body + "\n-----END PRIVATE KEY-----\n";
  }
}
