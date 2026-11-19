package com.supportfolio.platform.identity.token;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.nimbusds.jose.crypto.RSASSAVerifier;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jwt.SignedJWT;
import com.supportfolio.platform.identity.IdentityProperties;
import com.supportfolio.platform.identity.principal.IdentityRole;
import com.supportfolio.platform.identity.principal.InternalPrincipal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class JwksControllerTest {

  private static final long ACCESS_TOKEN_TTL_SECONDS = 3600;

  private IdentityProperties properties;
  private MockMvc mockMvc;

  @BeforeEach
  void setUp() throws Exception {
    KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
    generator.initialize(2048);
    KeyPair keyPair = generator.generateKeyPair();
    properties = properties(pem(keyPair.getPrivate()));
    mockMvc = MockMvcBuilders.standaloneSetup(new JwksController(properties)).build();
  }

  @Test
  void jwksEndpointPublishesTheKeyThatVerifiesIssuedTokens() throws Exception {
    RSAKey publishedKey = publishedKeys().getKeys().get(0).toRSAKey();

    String token =
        new JwtIssuer(properties)
            .issue(
                new InternalPrincipal(
                    "123", "octocat", "a@x.com", "The Octocat", IdentityRole.USER));
    SignedJWT parsed = SignedJWT.parse(token);

    assertNotNull(publishedKey.getKeyID());
    assertEquals(parsed.getHeader().getKeyID(), publishedKey.getKeyID());
    assertTrue(parsed.verify(new RSASSAVerifier(publishedKey.toRSAPublicKey())));
  }

  @Test
  void publishedKeyIdIsStableAcrossRequests() throws Exception {
    String firstKid = publishedKeys().getKeys().get(0).getKeyID();
    String secondKid = publishedKeys().getKeys().get(0).getKeyID();

    assertNotNull(firstKid);
    assertEquals(firstKid, secondKid);
  }

  @Test
  void constructsFromPrivateKeyFileWhenPemIsBlank() throws Exception {
    KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
    generator.initialize(2048);
    KeyPair keyPair = generator.generateKeyPair();
    RSAPublicKey publicKey = (RSAPublicKey) keyPair.getPublic();
    String pem = pem(keyPair.getPrivate());

    Path keyFile = Files.createTempFile("jwt-key", ".pem");
    try {
      Files.writeString(keyFile, pem);
      IdentityProperties fileProperties =
          new IdentityProperties(
              "http://localhost:8081",
              "owner-login",
              List.of("friend-login"),
              List.of("http://localhost:4200"),
              "",
              "https://api.github.com",
              60,
              ACCESS_TOKEN_TTL_SECONDS,
              keyFile.toAbsolutePath().toString());

      JwksController controller = new JwksController(fileProperties);
      Map<String, Object> jwks = controller.jwks();

      @SuppressWarnings("unchecked")
      List<Map<String, Object>> keys = (List<Map<String, Object>>) jwks.get("keys");
      assertEquals(1, keys.size());
      assertEquals(JwtIssuer.keyIdOf(publicKey), keys.get(0).get("kid"));
    } finally {
      Files.deleteIfExists(keyFile);
    }
  }

  private JWKSet publishedKeys() throws Exception {
    String body =
        mockMvc
            .perform(get("/oauth2/jwks"))
            .andExpect(status().isOk())
            .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
            .andReturn()
            .getResponse()
            .getContentAsString(StandardCharsets.UTF_8);
    JWKSet jwkSet = JWKSet.parse(body);
    assertEquals(1, jwkSet.getKeys().size());
    return jwkSet;
  }

  private static IdentityProperties properties(String privateKeyPem) {
    return new IdentityProperties(
        "http://localhost:8081",
        "owner-login",
        List.of("friend-login"),
        List.of("http://localhost:4200"),
        privateKeyPem,
        "https://api.github.com",
        60,
        ACCESS_TOKEN_TTL_SECONDS,
        null);
  }

  private static String pem(PrivateKey privateKey) {
    String body =
        Base64.getMimeEncoder(64, new byte[] {'\n'}).encodeToString(privateKey.getEncoded());
    return "-----BEGIN PRIVATE KEY-----\n" + body + "\n-----END PRIVATE KEY-----\n";
  }
}
