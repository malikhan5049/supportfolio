package com.supportfolio.tinyurl.link;

import java.time.Instant;

/**
 * The public view of a link. Deliberately excludes {@code createdBy} (creator identity never
 * appears in a public payload) and adds the click counter for the public browse list.
 */
public record LinkView(String slug, String targetUrl, long clickCount, Instant createdAt) {}
