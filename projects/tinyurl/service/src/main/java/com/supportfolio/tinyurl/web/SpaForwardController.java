package com.supportfolio.tinyurl.web;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class SpaForwardController {

  @GetMapping({"/", "/signin", "/auth/callback"})
  String forwardToIndex() {
    return "forward:/index.html";
  }
}
