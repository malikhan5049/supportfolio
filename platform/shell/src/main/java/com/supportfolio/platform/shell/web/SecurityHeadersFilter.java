package com.supportfolio.platform.shell.web;

import java.io.IOException;
import org.springframework.web.filter.OncePerRequestFilter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/** Security headers on every response: CSP from trusted origins, plus the classic hardening set. */
public class SecurityHeadersFilter extends OncePerRequestFilter {

  private final CspPolicy cspPolicy;

  public SecurityHeadersFilter(CspPolicy cspPolicy) {
    this.cspPolicy = cspPolicy;
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    response.setHeader("Content-Security-Policy", cspPolicy.headerValue());
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("X-Frame-Options", "DENY");
    chain.doFilter(request, response);
  }
}
