package com.supportfolio.platform.identity.login;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.AuthenticationException;

class LoginFailureHandlerTest {

  private final LoginFailureHandler handler = new LoginFailureHandler();
  private final AuthenticationException failure = new BadCredentialsException("no role");

  private MockHttpServletRequest requestWithTarget(String target) {
    MockHttpServletRequest request = new MockHttpServletRequest();
    if (target != null) {
      HttpSession session = request.getSession(true);
      session.setAttribute(LoginRedirectController.REDIRECT_ATTRIBUTE, target);
    }
    return request;
  }

  @Test
  void redirectsDeniedUsersBackToTheAlreadyValidatedTarget() throws IOException {
    MockHttpServletRequest request = requestWithTarget("https://shell.example.com/auth/callback");
    MockHttpServletResponse response = new MockHttpServletResponse();

    handler.onAuthenticationFailure(request, response, failure);

    assertEquals(HttpServletResponse.SC_FOUND, response.getStatus());
    assertEquals(
        "https://shell.example.com/auth/callback?error=access_denied",
        response.getHeader("Location"));
  }

  @Test
  void appendsWithAnAmpersandWhenTheTargetHasAQuery() throws IOException {
    MockHttpServletRequest request = requestWithTarget("https://x.example.com/cb?tab=1");
    MockHttpServletResponse response = new MockHttpServletResponse();

    handler.onAuthenticationFailure(request, response, failure);

    assertEquals(
        "https://x.example.com/cb?tab=1&error=access_denied", response.getHeader("Location"));
  }

  @Test
  void returnsBadRequestWithoutAStoredTarget() throws IOException {
    MockHttpServletRequest request = requestWithTarget(null);
    MockHttpServletResponse response = new MockHttpServletResponse();

    handler.onAuthenticationFailure(request, response, failure);

    assertEquals(HttpServletResponse.SC_BAD_REQUEST, response.getStatus());
    assertNull(response.getHeader("Location"));
  }
}
