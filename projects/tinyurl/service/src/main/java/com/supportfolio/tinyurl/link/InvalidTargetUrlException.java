package com.supportfolio.tinyurl.link;

/** A target URL rejected before any row is stored; mapped to {@code 400} by the web layer. */
public class InvalidTargetUrlException extends RuntimeException {

  public InvalidTargetUrlException(String message) {
    super(message);
  }

  public InvalidTargetUrlException(String message, Throwable cause) {
    super(message, cause);
  }
}
