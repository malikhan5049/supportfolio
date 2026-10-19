package com.supportfolio.platform.identity.login;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verify;

import com.supportfolio.platform.identity.IdentityProperties;
import com.supportfolio.platform.identity.principal.IdentityRole;
import com.supportfolio.platform.identity.principal.InternalPrincipal;
import com.supportfolio.platform.identity.token.OneTimeCodeStore;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;

class LoginSuccessHandlerTest {

  private static final String TARGET_WITHOUT_QUERY = "https://shell.example.com/home";
  private static final String TARGET_WITH_QUERY = "https://shell.example.com/home?tab=1";

  private OneTimeCodeStore store;
  private LoginSuccessHandler handler;

  @BeforeEach
  void setUp() {
    store = spy(new OneTimeCodeStore(properties()));
    handler = new LoginSuccessHandler(store);
  }

  @Test
  void appendsAOneTimeCodeToTheStoredTargetAndTheCodeExchangesForThePrincipal() throws Exception {
    MockHttpServletRequest request = new MockHttpServletRequest();
    request
        .getSession()
        .setAttribute(LoginRedirectController.REDIRECT_ATTRIBUTE, TARGET_WITHOUT_QUERY);
    MockHttpServletResponse response = new MockHttpServletResponse();

    handler.onAuthenticationSuccess(request, response, authentication());

    assertEquals(302, response.getStatus());
    String location = response.getHeader("Location");
    assertNotNull(location);
    assertTrue(location.startsWith(TARGET_WITHOUT_QUERY));
    assertTrue(location.contains("?code="));
    String code = location.substring(location.indexOf("code=") + "code=".length());
    Optional<InternalPrincipal> principal = store.consume(code);
    assertTrue(principal.isPresent());
    assertEquals(
        new InternalPrincipal("123", "octocat", "a@x.com", "The Octocat", IdentityRole.USER),
        principal.get());
  }

  @Test
  void appendsTheCodeWithAnAmpersandWhenTheTargetAlreadyHasAQuery() throws Exception {
    MockHttpServletRequest request = new MockHttpServletRequest();
    request
        .getSession()
        .setAttribute(LoginRedirectController.REDIRECT_ATTRIBUTE, TARGET_WITH_QUERY);
    MockHttpServletResponse response = new MockHttpServletResponse();

    handler.onAuthenticationSuccess(request, response, authentication());

    assertEquals(302, response.getStatus());
    String location = response.getHeader("Location");
    assertNotNull(location);
    assertTrue(location.startsWith(TARGET_WITH_QUERY + "&code="));
  }

  @Test
  void rejectedWithoutAStoredTargetAndNoCodeIsCreated() throws Exception {
    MockHttpServletRequest request = new MockHttpServletRequest();
    MockHttpServletResponse response = new MockHttpServletResponse();

    handler.onAuthenticationSuccess(request, response, authentication());

    assertEquals(400, response.getStatus());
    verify(store, never()).create(any(InternalPrincipal.class));
  }

  @Test
  void rejectedWhenTheSessionExistsButCarriesNoTarget() throws Exception {
    MockHttpServletRequest request = new MockHttpServletRequest();
    request.getSession();
    MockHttpServletResponse response = new MockHttpServletResponse();

    handler.onAuthenticationSuccess(request, response, authentication());

    assertEquals(400, response.getStatus());
    verify(store, never()).create(any(InternalPrincipal.class));
  }

  private static Authentication authentication() {
    OAuth2User user =
        new DefaultOAuth2User(
            List.of(new SimpleGrantedAuthority("ROLE_USER")),
            Map.of(
                "sub", "123",
                "preferred_username", "octocat",
                "email", "a@x.com",
                "name", "The Octocat",
                "role", "user"),
            "preferred_username");
    return new OAuth2AuthenticationToken(user, user.getAuthorities(), "github");
  }

  private static IdentityProperties properties() {
    return new IdentityProperties(
        "http://localhost:8081",
        "owner",
        List.of("friend"),
        List.of("http://localhost:4200"),
        "unused-private-key-pem",
        "https://api.github.com",
        60,
        3600);
  }
}
