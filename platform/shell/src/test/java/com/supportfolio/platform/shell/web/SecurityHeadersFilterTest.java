package com.supportfolio.platform.shell.web;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.supportfolio.platform.shell.registry.RemoteRegistryProperties;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class SecurityHeadersFilterTest {

  @TempDir static Path tempDir;

  static Path registryFile;

  @DynamicPropertySource
  static void registry(DynamicPropertyRegistry registry) {
    registry.add(
        "supportfolio.shell.remote-registry-file", () -> registryFile.toAbsolutePath().toString());
  }

  @BeforeAll
  static void writeRegistry() throws IOException {
    registryFile = tempDir.resolve("remote-registry.json");
    Files.writeString(
        registryFile,
        """
        {"projects":[{
          "id":"identity","displayName":"Identity","shortDescription":"SSO.",
          "features":["GitHub sign-in"],"openUrl":"http://localhost:8081",
          "exposedModules":[{"name":"card","version":"1.0.0",
                             "remoteEntry":"http://localhost:4301/remoteEntry.js"}]
        }]}
        """);
  }

  @Autowired MockMvc mockMvc;

  @Autowired RemoteRegistryProperties properties;

  @Test
  void setsTheFourSecurityHeadersOnEveryResponse() throws Exception {
    mockMvc
        .perform(get("/api/remote-registry"))
        .andExpect(status().isOk())
        .andExpect(header().string("X-Content-Type-Options", "nosniff"))
        .andExpect(header().string("Referrer-Policy", "no-referrer"))
        .andExpect(header().string("X-Frame-Options", "DENY"))
        .andExpect(
            header()
                .string(
                    "Content-Security-Policy",
                    new CspPolicy(properties.trustedRemoteOrigins()).headerValue()));
  }
}
