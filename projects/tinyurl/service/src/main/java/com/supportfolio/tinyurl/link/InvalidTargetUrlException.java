package com.supportfolio.tinyurl.link;

public class InvalidTargetUrlException extends RuntimeException {

  public InvalidTargetUrlException(String message) {
    super(message);
  }

  public InvalidTargetUrlException(String message, Throwable cause) {
    super(message, cause);
  }
}
