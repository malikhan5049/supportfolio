package com.supportfolio.platform.sharedstarter.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.FilteredClassLoader;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.web.SecurityFilterChain;

class IdentityResourceServerAutoConfigurationTest {
  private final ApplicationContextRunner runner =
      new ApplicationContextRunner()
          .withConfiguration(AutoConfigurations.of(IdentityResourceServerAutoConfiguration.class));

  @Test
  void inertWhenFlagIsAbsent() {
    runner.run(context -> assertThat(context).doesNotHaveBean(SecurityFilterChain.class));
  }

  @Test
  void inertWhenSecurityRuntimeAbsent() {
    runner
        .withClassLoader(new FilteredClassLoader(NimbusJwtDecoder.class, SecurityFilterChain.class))
        .withPropertyValues("supportfolio.security.resource-server.enabled=true")
        .run(context -> assertThat(context).doesNotHaveBean(SecurityFilterChain.class));
  }

  @Test
  void securesEverythingWhenEnabled() {
    runner
        .withPropertyValues(
            "supportfolio.security.resource-server.enabled=true",
            "supportfolio.security.jwk-set-uri=http://localhost:8081/oauth2/jwks",
            "supportfolio.security.issuer-uri=http://localhost:8081")
        .run(context -> assertThat(context).hasSingleBean(SecurityFilterChain.class));
  }

  @Test
  void emptyPermitAndCsrfListsKeepPlanTwoBehavior() {
    runner
        .withPropertyValues(
            "supportfolio.security.resource-server.enabled=true",
            "supportfolio.security.jwk-set-uri=http://localhost:8081/oauth2/jwks",
            "supportfolio.security.issuer-uri=http://localhost:8081")
        .run(
            context -> {
              SharedSecurityProperties props = context.getBean(SharedSecurityProperties.class);
              assertThat(props.permitPaths()).isEmpty();
              assertThat(props.csrfIgnorePaths()).isEmpty();
            });
  }

  private final IdentityResourceServerAutoConfiguration autoConfiguration =
      new IdentityResourceServerAutoConfiguration();

  @Test
  void userRoleClaimMapsToRoleUserAuthority() {
    AbstractAuthenticationToken authentication =
        autoConfiguration.roleMapper().convert(jwtWithRole("user"));

    assertThat(roleAuthorities(authentication))
        .containsExactly(new SimpleGrantedAuthority("ROLE_USER"));
  }

  @Test
  void adminRoleClaimMapsToRoleAdminAuthority() {
    AbstractAuthenticationToken authentication =
        autoConfiguration.roleMapper().convert(jwtWithRole("admin"));

    assertThat(roleAuthorities(authentication))
        .containsExactly(new SimpleGrantedAuthority("ROLE_ADMIN"));
  }

  @Test
  void missingRoleClaimYieldsNoAuthorities() {
    AbstractAuthenticationToken authentication =
        autoConfiguration.roleMapper().convert(jwtWithRole(null));

    // Spring Security 7 adds its own non-role FactorGrantedAuthority; the starter contributes none.
    assertThat(roleAuthorities(authentication)).isEmpty();
  }

  /**
   * The starter's converter only maps the {@code role} claim; Spring Security may add its own
   * non-authentication factor authorities, so pin exactly the {@code ROLE_*} subset.
   */
  private static List<GrantedAuthority> roleAuthorities(
      AbstractAuthenticationToken authentication) {
    return authentication.getAuthorities().stream()
        .filter(authority -> authority.getAuthority().startsWith("ROLE_"))
        .toList();
  }

  private static Jwt jwtWithRole(String role) {
    Map<String, Object> claims = new HashMap<>();
    claims.put("sub", "user-123");
    if (role != null) {
      claims.put("role", role);
    }
    return new Jwt(
        "token-value",
        Instant.now(),
        Instant.now().plusSeconds(60),
        Map.of("alg", "RS256"),
        claims);
  }
}
