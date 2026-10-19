package com.supportfolio.platform.shell.registry;

import java.io.File;
import java.io.IOException;
import java.net.URI;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

/**
 * Reads the remote registry file on every call — no cache, no restart: a CD pipeline rewrites the
 * file and the next request sees it. Every project is validated against the trusted-origin
 * allowlist (configuration, not registry data); a project failing any rule is dropped with a
 * warning that names only its id.
 */
@Component
public class RemoteRegistry {

  private static final Logger log = LoggerFactory.getLogger(RemoteRegistry.class);
  private static final Pattern PROJECT_ID = Pattern.compile("^[a-z0-9][a-z0-9-]*$");
  private static final Pattern SEMVER = Pattern.compile("^\\d+\\.\\d+\\.\\d+$");

  private record RegistryFile(List<RemoteProject> projects) {}

  private final RemoteRegistryProperties properties;
  private final ObjectMapper objectMapper;
  private final Set<String> trustedOrigins;

  public RemoteRegistry(RemoteRegistryProperties properties, ObjectMapper objectMapper) {
    this.properties = properties;
    this.objectMapper = objectMapper;
    this.trustedOrigins = new HashSet<>();
    List<String> origins = properties.trustedRemoteOrigins() == null
        ? List.of()
        : properties.trustedRemoteOrigins();
    for (String origin : origins) {
      this.trustedOrigins.add(normalizedOrigin(origin));
    }
  }

  public List<RemoteProject> projects() {
    List<RemoteProject> raw = read();
    List<RemoteProject> valid = new ArrayList<>();
    Set<String> seenIds = new HashSet<>();
    for (RemoteProject project : raw) {
      if (project.id() == null || seenIds.contains(project.id())) {
        if (project.id() != null) {
          log.warn("Dropping duplicate remote registry project starting with {}", project.id());
        }
        continue;
      }
      List<String> violations = violations(project);
      if (!violations.isEmpty()) {
        log.warn("Dropping remote registry project {} — {}", project.id(), violations.get(0));
        continue;
      }
      valid.add(project);
      seenIds.add(project.id());
    }
    return valid;
  }

  private List<RemoteProject> read() {
    File file = new File(properties.remoteRegistryFile());
    if (!file.exists()) {
      throw new RemoteRegistryException("Remote registry file not found");
    }
    try {
      return objectMapper.readValue(Files.readString(file.toPath()), RegistryFile.class).projects();
    } catch (IOException | RuntimeException e) {
      throw new RemoteRegistryException("Remote registry file unreadable", e);
    }
  }

  private List<String> violations(RemoteProject project) {
    List<String> violations = new ArrayList<>();
    if (project.id() == null || !PROJECT_ID.matcher(project.id()).matches()) {
      violations.add("invalid id");
    }
    if (blank(project.displayName()) || blank(project.shortDescription())) {
      violations.add("blank display or description");
    }
    if (project.features() == null) {
      violations.add("missing features");
    }
    if (project.openUrl() == null || !isHttpUrl(project.openUrl())) {
      violations.add("invalid openUrl");
    }
    if (project.exposedModules() == null || project.exposedModules().isEmpty()) {
      violations.add("no exposed modules");
    } else if (project.exposedModules().stream().noneMatch(module -> "card".equals(module.name()))) {
      violations.add("no card module");
    }
    for (ExposedModule module : project.exposedModules() == null
        ? List.<ExposedModule>of()
        : project.exposedModules()) {
      if (module.version() == null || !SEMVER.matcher(module.version()).matches()) {
        violations.add("module " + module.name() + " has a non-semver version");
      }
      if (module.remoteEntry() == null
          || !isHttpUrl(module.remoteEntry())
          || !trustedOrigins.contains(originOf(module.remoteEntry()))) {
        violations.add("module " + module.name() + " remoteEntry is not a trusted origin");
      }
    }
    return violations;
  }

  private static boolean blank(String value) {
    return value == null || value.isBlank();
  }

  private static boolean isHttpUrl(String url) {
    return originOf(url) != null;
  }

  private static String normalizedOrigin(String value) {
    URI uri;
    try {
      uri = URI.create(value);
    } catch (RuntimeException e) {
      throw new IllegalStateException("Not a valid trusted origin: " + value, e);
    }
    if (uri.getScheme() == null
        || uri.getHost() == null
        || uri.getPath() != null
            && !uri.getPath().isBlank()
            && !uri.getPath().equals("/")
        || uri.getQuery() != null
        || uri.getFragment() != null
        || (!uri.getScheme().equalsIgnoreCase("http")
            && !uri.getScheme().equalsIgnoreCase("https"))) {
      throw new IllegalStateException("Not a valid trusted origin: " + value);
    }
    return originOf(uri);
  }

  /** Lenient origin extraction for validating remoteEntry URLs against the allowlist. */
  private static String originOf(String url) {
    try {
      return originOf(URI.create(url));
    } catch (RuntimeException e) {
      return null;
    }
  }

  private static String originOf(URI uri) {
    if (uri.getScheme() == null
        || uri.getHost() == null
        || (!uri.getScheme().equalsIgnoreCase("http")
            && !uri.getScheme().equalsIgnoreCase("https"))) {
      return null;
    }
    int port = uri.getPort();
    if (port == -1) {
      port = uri.getScheme().equalsIgnoreCase("https") ? 443 : 80;
    }
    String scheme = uri.getScheme().toLowerCase(Locale.ROOT);
    String host = uri.getHost().toLowerCase(Locale.ROOT);
    if ((scheme.equals("http") && port == 80) || (scheme.equals("https") && port == 443)) {
      return scheme + "://" + host;
    }
    return scheme + "://" + host + ":" + port;
  }
}
