package com.supportfolio.tinyurl.web;

import com.supportfolio.tinyurl.link.InvalidTargetUrlException;
import com.supportfolio.tinyurl.link.LinkNotFoundException;
import com.supportfolio.tinyurl.link.RateLimitedException;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {

  @ExceptionHandler(RateLimitedException.class)
  public ResponseEntity<Map<String, String>> rateLimited() {
    return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
        .body(Map.of("error", "rate_limited"));
  }

  @ExceptionHandler(LinkNotFoundException.class)
  public ResponseEntity<Map<String, String>> linkNotFound() {
    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "link_not_found"));
  }

  @ExceptionHandler(InvalidTargetUrlException.class)
  public ResponseEntity<Map<String, String>> invalidTargetUrl() {
    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
        .body(Map.of("error", "invalid_target_url"));
  }
}
