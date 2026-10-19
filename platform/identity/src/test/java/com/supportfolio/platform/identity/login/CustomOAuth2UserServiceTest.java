package com.supportfolio.platform.identity.login;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.supportfolio.platform.identity.principal.ExternalIdentity;
import com.supportfolio.platform.identity.principal.IdentityProvider;
import com.supportfolio.platform.identity.principal.IdentityRole;
import com.supportfolio.platform.identity.principal.RoleResolver;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.OAuth2AccessToken;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.OAuth2User;

class CustomOAuth2UserServiceTest {

  private final IdentityProvider identityProvider = mock(IdentityProvider.class);
  private final RoleResolver roleResolver = mock(RoleResolver.class);
  private final CustomOAuth2UserService userService =
      new CustomOAuth2UserService(identityProvider, roleResolver);

  @Test
  void allowedLoginProducesTheJwtClaimAttributeContract() {
    when(identityProvider.fetch("gh-token"))
        .thenReturn(new ExternalIdentity("123", "octocat", "a@x.com", "The Octocat"));
    when(roleResolver.resolve("octocat")).thenReturn(Optional.of(IdentityRole.USER));

    OAuth2User user = userService.loadUser(userRequest("gh-token"));

    assertEquals("123", user.getAttribute("sub"));
    assertEquals("octocat", user.getAttribute("preferred_username"));
    assertEquals("a@x.com", user.getAttribute("email"));
    assertEquals("The Octocat", user.getAttribute("name"));
    assertEquals("user", user.getAttribute("role"));
    assertTrue(user.getAuthorities().contains(new SimpleGrantedAuthority("ROLE_USER")));
  }

  @Test
  void deniedLoginThrowsAccessDeniedBeforeAnyUserIsBuilt() {
    when(identityProvider.fetch("gh-token"))
        .thenReturn(new ExternalIdentity("404", "mallory", null, null));
    when(roleResolver.resolve("mallory")).thenReturn(Optional.empty());

    OAuth2AuthenticationException exception =
        assertThrows(
            OAuth2AuthenticationException.class,
            () -> userService.loadUser(userRequest("gh-token")));

    assertEquals("access_denied", exception.getError().getErrorCode());
  }

  private static OAuth2UserRequest userRequest(String accessToken) {
    ClientRegistration github =
        ClientRegistration.withRegistrationId("github")
            .clientId("test")
            .clientSecret("test")
            .authorizationUri("https://github.com/login/oauth/authorize")
            .tokenUri("https://github.com/login/oauth/access_token")
            .redirectUri("{baseUrl}/login/oauth2/code/{registrationId}")
            .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
            .build();
    Instant issuedAt = Instant.now();
    return new OAuth2UserRequest(
        github,
        new OAuth2AccessToken(
            OAuth2AccessToken.TokenType.BEARER, accessToken, issuedAt, issuedAt.plusSeconds(3600)));
  }
}
