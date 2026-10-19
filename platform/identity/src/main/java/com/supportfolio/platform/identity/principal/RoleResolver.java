package com.supportfolio.platform.identity.principal;

import com.supportfolio.platform.identity.IdentityProperties;
import java.util.Optional;

public class RoleResolver {

  private final IdentityProperties identityProperties;

  public RoleResolver(IdentityProperties identityProperties) {
    this.identityProperties = identityProperties;
  }

  public Optional<IdentityRole> resolve(String login) {
    if (login == null) {
      return Optional.empty();
    }
    if (login.equalsIgnoreCase(identityProperties.adminLogin())) {
      return Optional.of(IdentityRole.ADMIN);
    }
    if (identityProperties.allowlist() != null && identityProperties.allowlist().contains(login)) {
      return Optional.of(IdentityRole.USER);
    }
    return Optional.empty();
  }
}
