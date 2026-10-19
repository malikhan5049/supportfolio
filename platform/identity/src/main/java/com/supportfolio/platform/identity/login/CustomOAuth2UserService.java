package com.supportfolio.platform.identity.login;

import com.supportfolio.platform.identity.principal.ExternalIdentity;
import com.supportfolio.platform.identity.principal.IdentityProvider;
import com.supportfolio.platform.identity.principal.IdentityRole;
import com.supportfolio.platform.identity.principal.RoleResolver;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;

/**
 * Loads the GitHub profile behind the granted access token and resolves the internal role before
 * any principal exists. A login without a role is denied here, so a denied user never reaches the
 * success handler and never produces a one-time code. On success the returned attributes carry the
 * JWT claim names ({@code sub}, {@code preferred_username}, {@code email}, {@code name}, {@code
 * role}) so the success handler maps them 1:1 into the issued token.
 */
public class CustomOAuth2UserService extends DefaultOAuth2UserService {

  private final IdentityProvider identityProvider;
  private final RoleResolver roleResolver;

  public CustomOAuth2UserService(IdentityProvider identityProvider, RoleResolver roleResolver) {
    this.identityProvider = identityProvider;
    this.roleResolver = roleResolver;
  }

  @Override
  public OAuth2User loadUser(OAuth2UserRequest userRequest) {
    ExternalIdentity identity =
        identityProvider.fetch(userRequest.getAccessToken().getTokenValue());
    IdentityRole role =
        roleResolver
            .resolve(identity.login())
            .orElseThrow(
                () ->
                    new OAuth2AuthenticationException(new OAuth2Error("access_denied"), "no role"));
    Map<String, Object> attributes = new LinkedHashMap<>();
    attributes.put("sub", identity.providerUserId());
    attributes.put("preferred_username", identity.login());
    attributes.put("email", identity.email());
    attributes.put("name", identity.displayName());
    attributes.put("role", role.name().toLowerCase(Locale.ROOT));
    return new DefaultOAuth2User(
        Collections.singletonList(new SimpleGrantedAuthority("ROLE_" + role.name())),
        attributes,
        "preferred_username");
  }
}
