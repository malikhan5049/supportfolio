package com.supportfolio.platform.identity.login;

import com.supportfolio.platform.identity.principal.IdentityRole;
import com.supportfolio.platform.identity.principal.InternalPrincipal;
import com.supportfolio.platform.identity.token.OneTimeCodeStore;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;
import java.util.Locale;
import java.util.Map;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;

/**
 * Completes the login hand-off: mints a single-use code for the authenticated principal and 302
 * redirects back to the session-stored target with the code appended. A login that carries no
 * stored target (or no session) is rejected with a 400 before any code exists. Nothing about the
 * identity or the target URL is logged.
 */
public class LoginSuccessHandler implements AuthenticationSuccessHandler {

  private final OneTimeCodeStore codeStore;

  public LoginSuccessHandler(OneTimeCodeStore codeStore) {
    this.codeStore = codeStore;
  }

  @Override
  public void onAuthenticationSuccess(
      HttpServletRequest request, HttpServletResponse response, Authentication authentication)
      throws IOException {
    HttpSession session = request.getSession(false);
    Object storedTarget =
        session == null ? null : session.getAttribute(LoginRedirectController.REDIRECT_ATTRIBUTE);
    if (!(storedTarget instanceof String target) || target.isBlank()) {
      response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
      return;
    }
    OAuth2User user = (OAuth2User) authentication.getPrincipal();
    String code = codeStore.create(principalFrom(user.getAttributes()));
    String redirect = target + (target.contains("?") ? "&code=" : "?code=") + code;
    response.setStatus(HttpServletResponse.SC_FOUND);
    response.setHeader("Location", redirect);
  }

  private static InternalPrincipal principalFrom(Map<String, Object> attributes) {
    return new InternalPrincipal(
        stringAttribute(attributes, "sub"),
        stringAttribute(attributes, "preferred_username"),
        stringAttribute(attributes, "email"),
        stringAttribute(attributes, "name"),
        IdentityRole.valueOf(stringAttribute(attributes, "role").toUpperCase(Locale.ROOT)));
  }

  private static String stringAttribute(Map<String, Object> attributes, String name) {
    Object value = attributes.get(name);
    return value == null ? null : String.valueOf(value);
  }
}
