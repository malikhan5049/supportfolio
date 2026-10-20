package com.supportfolio.platform.shell.web;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * Falls back to the SPA index for every client-side route the Angular router owns. These paths are
 * never proxied to Identity — `/auth/login` (exact) is the only auth route that leaves the shell.
 */
@Controller
public class SpaForwardController {

  @GetMapping({"/", "/signin", "/auth/callback", "/projects/**"})
  String forwardToIndex() {
    return "forward:/index.html";
  }
}
