package com.supportfolio.platform.identity.login;

import com.supportfolio.platform.identity.IdentityProperties;
import com.supportfolio.platform.identity.principal.RoleResolver;
import com.supportfolio.platform.identity.provider.GitHubIdentityProvider;
import com.supportfolio.platform.identity.token.JwtIssuer;
import com.supportfolio.platform.identity.token.OneTimeCodeStore;
import com.supportfolio.platform.identity.token.TokenController;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.client.RestClient;

/**
 * The single security configuration for the browser-facing GitHub OAuth2 login flow. Public surface
 * is exactly the login contract: the JWKS endpoint, the token exchange, the login pages, and the
 * redirect-gated login entry point; everything else requires an authenticated session.
 */
@Configuration
@EnableWebSecurity
@EnableConfigurationProperties(IdentityProperties.class)
public class SecurityConfig {

  @Bean
  SecurityFilterChain securityFilterChain(
      HttpSecurity http,
      CustomOAuth2UserService customOAuth2UserService,
      LoginSuccessHandler loginSuccessHandler)
      throws Exception {
    http.authorizeHttpRequests(
            authorize ->
                authorize
                    .requestMatchers("/oauth2/jwks", "/api/token", "/login/**", "/auth/login")
                    .permitAll()
                    .anyRequest()
                    .authenticated())
        .oauth2Login(
            oauth2 ->
                oauth2
                    .userInfoEndpoint(userInfo -> userInfo.userService(customOAuth2UserService))
                    .successHandler(loginSuccessHandler)
                    .failureUrl("/login?error"))
        .csrf(csrf -> csrf.ignoringRequestMatchers("/api/token"));
    return http.build();
  }

  @Bean
  GitHubIdentityProvider gitHubIdentityProvider(IdentityProperties identityProperties) {
    return new GitHubIdentityProvider(RestClient.builder(), identityProperties);
  }

  @Bean
  RedirectOriginValidator redirectOriginValidator() {
    return new RedirectOriginValidator();
  }

  @Bean
  RoleResolver roleResolver(IdentityProperties identityProperties) {
    return new RoleResolver(identityProperties);
  }

  @Bean
  OneTimeCodeStore oneTimeCodeStore(IdentityProperties identityProperties) {
    return new OneTimeCodeStore(identityProperties);
  }

  @Bean
  CustomOAuth2UserService customOAuth2UserService(
      GitHubIdentityProvider gitHubIdentityProvider, RoleResolver roleResolver) {
    return new CustomOAuth2UserService(gitHubIdentityProvider, roleResolver);
  }

  @Bean
  LoginSuccessHandler loginSuccessHandler(OneTimeCodeStore oneTimeCodeStore) {
    return new LoginSuccessHandler(oneTimeCodeStore);
  }

  @Bean
  JwtIssuer jwtIssuer(IdentityProperties identityProperties) {
    return new JwtIssuer(identityProperties);
  }

  @Bean
  TokenController tokenController(
      OneTimeCodeStore oneTimeCodeStore,
      JwtIssuer jwtIssuer,
      IdentityProperties identityProperties) {
    return new TokenController(oneTimeCodeStore, jwtIssuer, identityProperties);
  }
}
