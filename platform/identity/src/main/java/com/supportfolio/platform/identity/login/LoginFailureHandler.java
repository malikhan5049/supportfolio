package com.supportfolio.platform.identity.login;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;

/**
 * Denied users come back to the app that started the login instead of landing on Identity's 404
 * error page (Plan 2 handoff): 302 to the already-origin-validated stored target with
 * {@code error=access_denied}. No codes are minted here, and no identity data is logged.
 */
public class LoginFailureHandler implements AuthenticationFailureHandler {

  @Override
  public void onAuthenticationFailure(
      HttpServletRequest request, HttpServletResponse response, AuthenticationException exception)
      throws IOException {
    HttpSession session = request.getSession(false);
    Object storedTarget =
        session == null ? null : session.getAttribute(LoginRedirectController.REDIRECT_ATTRIBUTE);
    if (!(storedTarget instanceof String target) || target.isBlank()) {
      response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
      return;
    }
    String redirect = target + (target.contains("?") ? "&error=" : "?error=") + "access_denied";
    response.setStatus(HttpServletResponse.SC_FOUND);
    response.setHeader("Location", redirect);
  }
}
