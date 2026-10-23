package com.supportfolio.tinyurl.link;

import java.time.Instant;

public record LinkView(String slug, String targetUrl, long clickCount, Instant createdAt) {}
