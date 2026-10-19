package com.supportfolio.platform.sharedstarter.security;

import java.util.Collections;
import java.util.Locale;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Opt-in OAuth2 resource-server security for any service consuming JWTs issued by the Identity
 * service. Activates only when {@code supportfolio.security.resource-server.enabled=true} (the
 * attribute default) <em>and</em> the Spring Security resource-server runtime is on the classpath —
 * this starter declares it {@code compileOnly} only, so a consumer that has not opted in keeps its
 * own security setup untouched.
 */
@AutoConfiguration
@ConditionalOnClass(NimbusJwtDecoder.class)
@ConditionalOnProperty(name = "supportfolio.security.resource-server.enabled", havingValue = "true")
@EnableConfigurationProperties(SharedSecurityProperties.class)
// Spring Security 7 makes HttpSecurityConfiguration (the prototype HttpSecurity bean producer)
// package-private, so the public @EnableWebSecurity meta-annotation (which imports exactly that
// machinery via @EnableGlobalAuthentication) is used instead of a direct @Import.
@EnableWebSecurity
public class IdentityResourceServerAutoConfiguration {

  @Bean
  SecurityFilterChain securityFilterChain(HttpSecurity http, SharedSecurityProperties props)
      throws Exception {
    NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(props.jwkSetUri()).build();
    decoder.setJwtValidator(JwtValidators.createDefaultWithIssuer(props.issuerUri()));
    return http
        .authorizeHttpRequests(
            authorize -> {
              if (!props.permitPaths().isEmpty()) {
                authorize
                    .requestMatchers(props.permitPaths().toArray(String[]::new))
                    .permitAll();
              }
              authorize.anyRequest().authenticated();
            })
        .csrf(csrf -> {
          if (!props.csrfIgnorePaths().isEmpty()) {
            csrf.ignoringRequestMatchers(props.csrfIgnorePaths().toArray(String[]::new));
          }
        })
        .oauth2ResourceServer(
            oauth2 ->
                oauth2.jwt(jwt -> jwt.decoder(decoder).jwtAuthenticationConverter(roleMapper())))
        .build();
  }

  /**
   * Maps the {@code role} claim issued by the Identity service to {@code ROLE_<ROLE>} authorities.
   * A token without a {@code role} claim is still granted — it simply carries no roles.
   */
  JwtAuthenticationConverter roleMapper() {
    JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
    converter.setJwtGrantedAuthoritiesConverter(
        jwt -> {
          String role = jwt.getClaimAsString("role");
          if (role == null || role.isBlank()) {
            return Collections.<GrantedAuthority>emptyList();
          }
          GrantedAuthority authority =
              new SimpleGrantedAuthority("ROLE_" + role.toUpperCase(Locale.ROOT));
          return Collections.singletonList(authority);
        });
    return converter;
  }
}
