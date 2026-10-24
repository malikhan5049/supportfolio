package com.supportfolio.tinyurl.link;

/** The hourly shorten cap was hit; mapped to {@code 429 {"error":"rate_limited"}}. */
public class RateLimitedException extends RuntimeException {

  public RateLimitedException() {
    super("hourly shorten cap reached");
  }
}
