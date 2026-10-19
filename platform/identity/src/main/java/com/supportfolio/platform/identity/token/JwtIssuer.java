package com.supportfolio.platform.identity.token;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import com.supportfolio.platform.identity.IdentityProperties;
import com.supportfolio.platform.identity.principal.InternalPrincipal;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.interfaces.RSAPrivateCrtKey;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.RSAPublicKeySpec;
import java.util.Base64;
import java.util.Date;
import java.util.Locale;

public class JwtIssuer {

  static final String CLAIM_PREFERRED_USERNAME = "preferred_username";
  static final String CLAIM_EMAIL = "email";
  static final String CLAIM_NAME = "name";
  static final String CLAIM_ROLE = "role";

  private final String issuer;
  private final long accessTokenTtlSeconds;
  private final String keyId;
  private final RSASSASigner signer;

  public JwtIssuer(IdentityProperties properties) {
    RSAPrivateKey privateKey = parsePrivateKeyPem(properties.jwtPrivateKeyPem());
    this.issuer = properties.issuer();
    this.accessTokenTtlSeconds = properties.accessTokenTtlSeconds();
    this.keyId = keyIdOf(publicKeyOf(privateKey));
    this.signer = new RSASSASigner(privateKey);
  }

  public String issue(InternalPrincipal principal) {
    Date now = new Date();
    JWTClaimsSet claims =
        new JWTClaimsSet.Builder()
            .issuer(issuer)
            .subject(principal.id())
            .claim(CLAIM_PREFERRED_USERNAME, principal.login())
            .claim(CLAIM_EMAIL, principal.email())
            .claim(CLAIM_NAME, principal.displayName())
            .claim(CLAIM_ROLE, principal.role().name().toLowerCase(Locale.ROOT))
            .issueTime(now)
            .expirationTime(new Date(now.getTime() + accessTokenTtlSeconds * 1000L))
            .build();
    SignedJWT jwt =
        new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.RS256).keyID(keyId).build(), claims);
    try {
      jwt.sign(signer);
    } catch (JOSEException e) {
      // Never put the token, its claims, or key material in this message.
      throw new IllegalStateException("Failed to sign the access token", e);
    }
    return jwt.serialize();
  }

  static RSAPrivateKey parsePrivateKeyPem(String privateKeyPem) {
    if (privateKeyPem == null || privateKeyPem.isBlank()) {
      throw new IllegalStateException(
          "supportfolio.identity.jwt-private-key-pem is not configured");
    }
    String body =
        privateKeyPem
            .replace("-----BEGIN PRIVATE KEY-----", "")
            .replace("-----END PRIVATE KEY-----", "")
            .replaceAll("\\s", "");
    try {
      byte[] pkcs8 = Base64.getDecoder().decode(body);
      return (RSAPrivateKey)
          KeyFactory.getInstance("RSA").generatePrivate(new PKCS8EncodedKeySpec(pkcs8));
    } catch (GeneralSecurityException | IllegalArgumentException e) {
      throw new IllegalStateException(
          "supportfolio.identity.jwt-private-key-pem is not a valid PKCS#8 RSA private key", e);
    }
  }

  static RSAPublicKey publicKeyOf(RSAPrivateKey privateKey) {
    if (!(privateKey instanceof RSAPrivateCrtKey crtKey)) {
      throw new IllegalStateException(
          "The configured RSA private key does not carry its public component");
    }
    try {
      return (RSAPublicKey)
          KeyFactory.getInstance("RSA")
              .generatePublic(
                  new RSAPublicKeySpec(crtKey.getModulus(), crtKey.getPublicExponent()));
    } catch (GeneralSecurityException e) {
      throw new IllegalStateException("Failed to derive the RSA public key", e);
    }
  }

  static String keyIdOf(RSAPublicKey publicKey) {
    try {
      byte[] modulusDigest =
          MessageDigest.getInstance("SHA-256").digest(publicKey.getModulus().toByteArray());
      return Base64.getUrlEncoder().withoutPadding().encodeToString(modulusDigest);
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException("SHA-256 is not available", e);
    }
  }
}
