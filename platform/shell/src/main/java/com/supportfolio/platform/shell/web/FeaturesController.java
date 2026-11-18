package com.supportfolio.platform.shell.web;

import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
class FeaturesController {

  private final boolean demoLogin;

  FeaturesController(
      @Value("${supportfolio.shell.demo-login-enabled:false}") boolean demoLogin) {
    this.demoLogin = demoLogin;
  }

  @GetMapping("/api/features")
  Map<String, Object> features() {
    return Map.of("demoLogin", demoLogin);
  }
}
