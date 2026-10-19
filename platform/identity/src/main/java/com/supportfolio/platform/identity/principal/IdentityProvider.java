package com.supportfolio.platform.identity.principal;

public interface IdentityProvider {
  ExternalIdentity fetch(String accessToken);
}
