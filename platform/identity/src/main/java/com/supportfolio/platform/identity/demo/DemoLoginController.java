package com.supportfolio.platform.identity.demo;

import com.supportfolio.platform.identity.principal.ExternalIdentity;
import com.supportfolio.platform.identity.principal.IdentityRole;
import com.supportfolio.platform.identity.principal.InternalPrincipal;
import com.supportfolio.platform.identity.token.OneTimeCodeStore;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@ConditionalOnProperty(name = "supportfolio.identity.demo-enabled", havingValue = "true")
class DemoLoginController {

  private static final InternalPrincipal DEMO_PRINCIPAL =
      InternalPrincipal.of(
          new ExternalIdentity("demo", "demo", "demo@example.invalid", "Demo Reviewer"),
          IdentityRole.ADMIN);

  private final OneTimeCodeStore codes;

  DemoLoginController(OneTimeCodeStore codes) {
    this.codes = codes;
  }

  @PostMapping("/api/demo-login")
  Map<String, String> login() {
    String code = codes.create(DEMO_PRINCIPAL);
    return Map.of("code", code);
  }
}
