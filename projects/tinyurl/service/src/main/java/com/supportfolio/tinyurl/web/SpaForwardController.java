package com.supportfolio.tinyurl.web;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * Forwards the SPA shell paths to the single index.html so deep routes like /signin and
 * /auth/callback resolve inside the Angular router; identity proxy paths are routed separately and
 * never reach here.
 */
@Controller
public class SpaForwardController {

  @GetMapping({"/", "/signin", "/auth/callback"})
  public String forwardToIndex() {
    return "forward:/index.html";
  }
}
