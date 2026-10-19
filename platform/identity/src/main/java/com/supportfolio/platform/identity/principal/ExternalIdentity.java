package com.supportfolio.platform.identity.principal;

public record ExternalIdentity(
    String providerUserId, String login, String email, String displayName) {}
