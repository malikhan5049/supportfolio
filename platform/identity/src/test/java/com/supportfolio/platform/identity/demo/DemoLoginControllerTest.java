package com.supportfolio.platform.identity.demo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.supportfolio.platform.identity.principal.IdentityRole;
import com.supportfolio.platform.identity.principal.InternalPrincipal;
import com.supportfolio.platform.identity.token.OneTimeCodeStore;
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

@SpringBootTest
class DemoLoginControllerTest {

  @Autowired private WebApplicationContext context;
  @Autowired private OneTimeCodeStore codes;

  private MockMvc mvc;

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
    registry.add("supportfolio.identity.demo-enabled", () -> "true");
    registry.add("spring.security.oauth2.client.registration.github.client-id", () -> "test");
    registry.add("spring.security.oauth2.client.registration.github.client-secret", () -> "test");
  }

  @BeforeEach
  void setUp() {
    mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
  }

  @Test
  void mintsConsumableAdminCode() throws Exception {
    String body =
        mvc.perform(post("/api/demo-login"))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();

    String code = JsonPath.read(body, "$.code");
    assertThat(code).hasSize(43);
    assertThat(codes.consume(code))
        .hasValueSatisfying(
            (InternalPrincipal p) -> assertThat(p.role()).isEqualTo(IdentityRole.ADMIN));
  }

  private static String pem(PrivateKey privateKey) {
    String body =
        Base64.getMimeEncoder(64, new byte[] {'\n'}).encodeToString(privateKey.getEncoded());
    return "-----BEGIN PRIVATE KEY-----\n" + body + "\n-----END PRIVATE KEY-----\n";
  }
}
