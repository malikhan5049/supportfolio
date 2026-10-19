package com.supportfolio.platform.identity.token;

import com.supportfolio.platform.identity.IdentityProperties;
import com.supportfolio.platform.identity.principal.InternalPrincipal;
import java.util.Locale;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * Exchanges the single-use login code minted by the login hand-off (Task 6) for an access token and
 * the principal behind it, completing the browser login for the Angular apps. Unknown,
 * already-used, and expired codes all produce the same 400 body, so probing with replayed or
 * guessed codes learns nothing about which case occurred. Nothing about the code, the token, or the
 * identity is logged.
 */
@RestController
public class TokenController {

  static final String TOKEN_TYPE_BEARER = "Bearer";
  static final String ERROR_KEY = "error";
  static final String ERROR_INVALID_CODE = "invalid_code";

  private final OneTimeCodeStore oneTimeCodeStore;
  private final JwtIssuer jwtIssuer;
  private final long accessTokenTtlSeconds;

  public TokenController(
      OneTimeCodeStore oneTimeCodeStore,
      JwtIssuer jwtIssuer,
      IdentityProperties identityProperties) {
    this.oneTimeCodeStore = oneTimeCodeStore;
    this.jwtIssuer = jwtIssuer;
    this.accessTokenTtlSeconds = identityProperties.accessTokenTtlSeconds();
  }

  @PostMapping("/api/token")
  public ResponseEntity<Object> exchange(@RequestBody TokenRequest request) {
    return oneTimeCodeStore
        .consume(request.code())
        .map(this::tokenResponse)
        .orElseGet(() -> ResponseEntity.badRequest().body(Map.of(ERROR_KEY, ERROR_INVALID_CODE)));
  }

  private ResponseEntity<Object> tokenResponse(InternalPrincipal principal) {
    TokenResponse response =
        new TokenResponse(
            jwtIssuer.issue(principal),
            TOKEN_TYPE_BEARER,
            accessTokenTtlSeconds,
            new PrincipalView(
                principal.id(),
                principal.login(),
                principal.email(),
                principal.displayName(),
                principal.role().name().toLowerCase(Locale.ROOT)));
    return ResponseEntity.ok(response);
  }

  /** Body of the token exchange request: the single-use code from the login redirect. */
  public record TokenRequest(String code) {}

  /** The exchange contract consumed by the Angular apps. */
  public record TokenResponse(
      String accessToken, String tokenType, long expiresIn, PrincipalView principal) {}

  /** The principal behind the token; {@code role} mirrors the JWT claim, lowercased. */
  public record PrincipalView(
      String id, String login, String email, String displayName, String role) {}
}
