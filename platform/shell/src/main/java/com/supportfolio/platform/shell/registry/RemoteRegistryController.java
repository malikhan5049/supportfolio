package com.supportfolio.platform.shell.registry;

import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Serves the validated remote registry to the SPA. A registry that cannot be read answers a typed
 * 503 without leaking file paths or validation internals — the renderer shows an error state, not a
 * half-empty grid.
 */
@RestController
public class RemoteRegistryController {

  private static final Logger log = LoggerFactory.getLogger(RemoteRegistryController.class);

  private final RemoteRegistry registry;

  public RemoteRegistryController(RemoteRegistry registry) {
    this.registry = registry;
  }

  @GetMapping("/api/remote-registry")
  ResponseEntity<Map<String, Object>> registry() {
    try {
      return ResponseEntity.ok(Map.of("projects", registry.projects()));
    } catch (RemoteRegistryException e) {
      log.warn("Remote registry unavailable: {}", e.getMessage());
      return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
          .body(Map.of("error", "registry_unavailable"));
    }
  }
}
