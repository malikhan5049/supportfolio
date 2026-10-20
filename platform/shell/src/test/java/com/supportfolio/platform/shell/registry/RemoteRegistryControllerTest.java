package com.supportfolio.platform.shell.registry;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

@ExtendWith(MockitoExtension.class)
class RemoteRegistryControllerTest {

  @Mock RemoteRegistry registry;

  MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    mockMvc = MockMvcBuilders.standaloneSetup(new RemoteRegistryController(registry)).build();
  }

  @Test
  void returnsProjectsFromTheRegistry() throws Exception {
    when(registry.projects())
        .thenReturn(
            List.of(
                new RemoteProject(
                    "identity",
                    "Identity",
                    "SSO and JWT issuance.",
                    List.of("GitHub sign-in"),
                    "http://localhost:8081",
                    List.of(
                        new ExposedModule(
                            "card", "1.0.0", "http://localhost:4301/remoteEntry.js")))));
    mockMvc
        .perform(get("/api/remote-registry"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.projects[0].id").value("identity"))
        .andExpect(jsonPath("$.projects[0].exposedModules[0].name").value("card"));
  }

  @Test
  void returnsTypedErrorWhenTheRegistryCannotBeRead() throws Exception {
    when(registry.projects())
        .thenThrow(new RemoteRegistryException("bad file", new RuntimeException()));
    mockMvc
        .perform(get("/api/remote-registry"))
        .andExpect(status().isServiceUnavailable())
        .andExpect(jsonPath("$.error").value("registry_unavailable"));
  }
}
