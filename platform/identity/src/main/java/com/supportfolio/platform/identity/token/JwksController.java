package com.supportfolio.platform.identity.token;

import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.supportfolio.platform.identity.IdentityProperties;
import java.security.interfaces.RSAPublicKey;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class JwksController {

  private final Map<String, Object> jwks;

  public JwksController(IdentityProperties properties) {
    RSAPublicKey publicKey =
        JwtIssuer.publicKeyOf(JwtIssuer.parsePrivateKeyPem(properties.jwtPrivateKeyPem()));
    RSAKey rsaKey = new RSAKey.Builder(publicKey).keyID(JwtIssuer.keyIdOf(publicKey)).build();
    this.jwks = new JWKSet(rsaKey).toJSONObject(true);
  }

  @GetMapping("/oauth2/jwks")
  public Map<String, Object> jwks() {
    return jwks;
  }
}
