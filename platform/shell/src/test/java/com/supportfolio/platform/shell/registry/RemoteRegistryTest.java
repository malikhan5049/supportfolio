package com.supportfolio.platform.shell.registry;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import tools.jackson.databind.ObjectMapper;

class RemoteRegistryTest {

  private static final String TRUSTED_ORIGIN = "http://localhost:4301";

  @TempDir File tempDir;

  private final ObjectMapper objectMapper = new ObjectMapper();

  private File registryFileWith(String json) throws IOException {
    File file = new File(tempDir, "remote-registry.json");
    Files.writeString(file.toPath(), json);
    return file;
  }

  private String oneProject(String remoteEntry, String version) {
    return """
        {"projects":[{
          "id":"identity",
          "displayName":"Identity",
          "shortDescription":"SSO and JWT issuance.",
          "features":["GitHub sign-in"],
          "openUrl":"http://localhost:8081",
          "exposedModules":[{"name":"card","version":"%s","remoteEntry":"%s"}]
        }]}
        """
        .formatted(version, remoteEntry);
  }

  private RemoteRegistry registryWith(String remoteEntry, String version) throws IOException {
    File file = registryFileWith(oneProject(remoteEntry, version));
    return new RemoteRegistry(properties(file), objectMapper);
  }

  private RemoteRegistry registry() throws IOException {
    return registryWith(TRUSTED_ORIGIN + "/remoteEntry.js", "1.0.0");
  }

  private RemoteRegistry registryWithFile(Path path) {
    return new RemoteRegistry(properties(path.toFile()), objectMapper);
  }

  private RemoteRegistryProperties properties(File file) {
    return new RemoteRegistryProperties(
        "http://localhost:8081", file.toPath().toString(), List.of(TRUSTED_ORIGIN));
  }

  @Test
  void constructorToleratesNullTrustedOriginsUntilConfigured() throws IOException {
    File file = registryFileWith(oneProject(TRUSTED_ORIGIN + "/remoteEntry.js", "1.0.0"));
    RemoteRegistryProperties props =
        new RemoteRegistryProperties("http://localhost:8081", file.toPath().toString(), null);
    assertThat(new RemoteRegistry(props, objectMapper).projects()).isEmpty();
  }

  @Test
  void loadsAValidRegistryEntry() throws IOException {
    RemoteRegistry registry = registry();
    assertEquals(List.of("identity"), registry.projects().stream().map(RemoteProject::id).toList());
  }

  @Test
  void dropsProjectWhoseRemoteEntryOriginIsNotTrusted() throws IOException {
    assertThat(registryWith("https://cdn.example.com.evil.com/remoteEntry.js", "1.0.0").projects())
        .isEmpty();
  }

  @Test
  void dropsProjectWithoutACardModule() throws IOException {
    File file =
        registryFileWith(
            """
            {"projects":[{
              "id":"identity",
              "displayName":"Identity",
              "shortDescription":"SSO and JWT issuance.",
              "features":["GitHub sign-in"],
              "openUrl":"http://localhost:8081",
              "exposedModules":[{"name":"widget","version":"1.0.0","remoteEntry":"%s"}]
            }]}
            """
                .formatted(TRUSTED_ORIGIN + "/remoteEntry.js"));
    assertThat(new RemoteRegistry(properties(file), objectMapper).projects()).isEmpty();
  }

  @Test
  void keepsTheFirstDuplicateProjectId() throws IOException {
    File file =
        registryFileWith(
            """
            {"projects":[
              {"id":"identity","displayName":"First","shortDescription":"First wins.","features":[],
               "openUrl":"http://localhost:8081",
               "exposedModules":[{"name":"card","version":"1.0.0","remoteEntry":"%s"}]},
              {"id":"identity","displayName":"Second","shortDescription":"Dropped.","features":[],
               "openUrl":"http://localhost:8081",
               "exposedModules":[{"name":"card","version":"1.0.0","remoteEntry":"%s"}]}
            ]}
            """
                .formatted(TRUSTED_ORIGIN + "/remoteEntry.js", TRUSTED_ORIGIN + "/remoteEntry.js"));
    List<RemoteProject> projects = new RemoteRegistry(properties(file), objectMapper).projects();
    assertEquals(1, projects.size());
    assertEquals("First", projects.get(0).displayName());
  }

  @Test
  void dropsProjectWithNonSemverVersion() throws IOException {
    assertThat(registryWith(TRUSTED_ORIGIN + "/remoteEntry.js", "1.0").projects()).isEmpty();
  }

  @Test
  void throwsWhenTheRegistryFileIsMissing() {
    assertThrows(
        RemoteRegistryException.class,
        () -> registryWithFile(new File(tempDir, "nope.json").toPath()).projects());
  }

  @Test
  void throwsWhenTheRegistryIsMalformedJson() throws IOException {
    File file = registryFileWith("{ nope");
    assertThrows(RemoteRegistryException.class, () -> registryWithFile(file.toPath()).projects());
  }

  @Test
  void throwsWhenTheProjectsListIsMissingOrNull() throws IOException {
    File emptyEnvelope = registryFileWith("{ }");
    assertThrows(
        RemoteRegistryException.class, () -> registryWithFile(emptyEnvelope.toPath()).projects());
    File nullProjects = registryFileWith("{\"projects\":null}");
    assertThrows(
        RemoteRegistryException.class, () -> registryWithFile(nullProjects.toPath()).projects());
  }

  @Test
  void reflectsARewrittenRegistryOnTheNextCall() throws IOException {
    File file = registryFileWith(oneProject(TRUSTED_ORIGIN + "/remoteEntry.js", "1.0.0"));
    RemoteRegistry registry = new RemoteRegistry(properties(file), objectMapper);
    assertEquals(1, registry.projects().size());

    Files.writeString(
        file.toPath(),
        """
        {"projects":[
          {"id":"identity","displayName":"Identity","shortDescription":"SSO.","features":[],
           "openUrl":"http://localhost:8081",
           "exposedModules":[{"name":"card","version":"1.0.0","remoteEntry":"%s"}]},
          {"id":"tinyurl","displayName":"TinyURL","shortDescription":"Short links.","features":[],
           "openUrl":"http://localhost:8090",
           "exposedModules":[{"name":"card","version":"1.0.0","remoteEntry":"%s"}]}
        ]}
        """
            .formatted(TRUSTED_ORIGIN + "/remoteEntry.js", TRUSTED_ORIGIN + "/remoteEntry.js"));
    assertEquals(2, registry.projects().size());
  }
}
