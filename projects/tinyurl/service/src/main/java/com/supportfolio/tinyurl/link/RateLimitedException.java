package com.supportfolio.tinyurl.link;

public class RateLimitedException extends RuntimeException {

  public RateLimitedException() {
    super("Shorten rate limit exceeded");
  }
}
