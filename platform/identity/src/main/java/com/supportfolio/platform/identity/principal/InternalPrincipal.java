package com.supportfolio.platform.identity.principal;

public record InternalPrincipal(
    String id, String login, String email, String displayName, IdentityRole role) {

  public static InternalPrincipal of(ExternalIdentity e, IdentityRole role) {
    return new InternalPrincipal(e.providerUserId(), e.login(), e.email(), e.displayName(), role);
  }
}
