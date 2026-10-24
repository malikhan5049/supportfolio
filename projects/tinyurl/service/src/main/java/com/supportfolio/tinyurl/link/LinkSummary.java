package com.supportfolio.tinyurl.link;

import java.time.Instant;

/** Spring Data projection for anonymous browse rows; a close-free shape of the public view. */
public interface LinkSummary {

  String getSlug();

  String getTargetUrl();

  Instant getCreatedAt();

  long getClickCount();
}
