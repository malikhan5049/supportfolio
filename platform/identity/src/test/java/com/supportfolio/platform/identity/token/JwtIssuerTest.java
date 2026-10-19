package com.supportfolio.platform.identity.token;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.crypto.RSASSAVerifier;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import com.supportfolio.platform.identity.IdentityProperties;
import com.supportfolio.platform.identity.principal.IdentityRole;
import com.supportfolio.platform.identity.principal.InternalPrincipal;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.util.Base64;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class JwtIssuerTest {

  private static final long ACCESS_TOKEN_TTL_SECONDS = 3600;
  private static final String ISSUER = "http://localhost:8081";

  private RSAPublicKey publicKey;
  private JwtIssuer jwtIssuer;
  private String token;

  @BeforeEach
  void issueToken() throws Exception {
    KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
    generator.initialize(2048);
    KeyPair keyPair = generator.generateKeyPair();
    publicKey = (RSAPublicKey) keyPair.getPublic();
    jwtIssuer = new JwtIssuer(properties(pem(keyPair.getPrivate())));
    token =
        jwtIssuer.issue(
            new InternalPrincipal("123", "octocat", "a@x.com", "The Octocat", IdentityRole.USER));
  }

  @Test
  void issuedTokenVerifiesAgainstItsOwnPublicKey() throws Exception {
    SignedJWT parsed = SignedJWT.parse(token);

    assertTrue(parsed.verify(new RSASSAVerifier(publicKey)));
    assertEquals(JWSAlgorithm.RS256, parsed.getHeader().getAlgorithm());
  }

  @Test
  void issuedTokenCarriesExactlyTheContractedClaims() throws Exception {
    SignedJWT parsed = SignedJWT.parse(token);
    JWTClaimsSet claims = parsed.getJWTClaimsSet();

    assertEquals(
        Set.of("iss", "sub", "preferred_username", "email", "name", "role", "iat", "exp"),
        claims.getClaims().keySet());
    assertEquals(ISSUER, claims.getIssuer());
    assertEquals("123", claims.getSubject());
    assertEquals("octocat", claims.getStringClaim("preferred_username"));
    assertEquals("a@x.com", claims.getStringClaim("email"));
    assertEquals("The Octocat", claims.getStringClaim("name"));
    assertEquals("user", claims.getStringClaim("role"));
    long lifetimeMillis = claims.getExpirationTime().getTime() - claims.getIssueTime().getTime();
    assertTrue(
        Math.abs(lifetimeMillis - ACCESS_TOKEN_TTL_SECONDS * 1000L) <= 5_000L,
        "exp - iat should be about 3600 seconds but was " + lifetimeMillis + " ms");
  }

  @Test
  void tamperedSignatureFailsVerification() throws Exception {
    String[] parts = token.split("\\.");
    byte[] signature = Base64.getUrlDecoder().decode(parts[2]);
    signature[0] ^= 0x01;
    String tampered =
        parts[0]
            + "."
            + parts[1]
            + "."
            + Base64.getUrlEncoder().withoutPadding().encodeToString(signature);

    assertFalse(SignedJWT.parse(tampered).verify(new RSASSAVerifier(publicKey)));
  }

  @Test
  void constructorFailsFastWhenPrivateKeyPemIsUnusable() {
    assertThrows(IllegalStateException.class, () -> new JwtIssuer(properties(null)));
    assertThrows(IllegalStateException.class, () -> new JwtIssuer(properties("")));
    assertThrows(
        IllegalStateException.class,
        () ->
            new JwtIssuer(
                properties(
                    "-----BEGIN PRIVATE KEY-----\n@@@not-base64@@@\n-----END PRIVATE KEY-----")));
  }

  private static IdentityProperties properties(String privateKeyPem) {
    return new IdentityProperties(
        ISSUER,
        "owner-login",
        List.of("friend-login"),
        List.of("http://localhost:4200"),
        privateKeyPem,
        "https://api.github.com",
        60,
        ACCESS_TOKEN_TTL_SECONDS);
  }

  private static String pem(PrivateKey privateKey) {
    String body =
        Base64.getMimeEncoder(64, new byte[] {'\n'}).encodeToString(privateKey.getEncoded());
    return "-----BEGIN PRIVATE KEY-----\n" + body + "\n-----END PRIVATE KEY-----\n";
  }
}
