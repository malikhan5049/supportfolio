package com.supportfolio.tinyurl.link;

import java.time.Instant;

public interface LinkSummary {

  String getSlug();

  String getTargetUrl();

  Instant getCreatedAt();

  long getClickCount();
}
