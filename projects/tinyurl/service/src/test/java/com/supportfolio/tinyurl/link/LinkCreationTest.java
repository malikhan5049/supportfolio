package com.supportfolio.tinyurl.link;

import static org.hamcrest.Matchers.matchesPattern;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.supportfolio.tinyurl.PostgresIntegrationTest;
import java.net.InetAddress;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@AutoConfigureMockMvc
@Import(LinkCreationTest.ResolverConfiguration.class)
@Transactional
class LinkCreationTest extends PostgresIntegrationTest {

  @Autowired MockMvc mockMvc;
  @Autowired LinkRepository links;
  @Autowired JdbcTemplate jdbc;

  @Test
  void createsALinkForAnAdminAndStoresTheJwtSubject() throws Exception {
    mockMvc
        .perform(
            post("/api/links")
                .with(jwt().jwt(token -> token.subject("admin-1").claim("role", "admin")))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"targetUrl\":\"https://example.com/a\"}"))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.slug").value(matchesPattern("[0-9A-Za-z]{8}")))
        .andExpect(jsonPath("$.targetUrl").value("https://example.com/a"))
        .andExpect(jsonPath("$.clickCount").value(0))
        .andExpect(jsonPath("$.createdAt").exists())
        .andExpect(jsonPath("$.createdBy").doesNotExist());
    assertEquals("admin-1", links.findAll().get(0).getCreatedBy());
  }

  @Test
  void createsALinkForAnAllowlistedUser() throws Exception {
    mockMvc
        .perform(
            post("/api/links")
                .with(jwt().jwt(token -> token.subject("user-1").claim("role", "user")))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"targetUrl\":\"https://example.com/a\"}"))
        .andExpect(status().isCreated());
  }

  @Test
  void rejectsAnonymousShorten() throws Exception {
    mockMvc
        .perform(
            post("/api/links")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"targetUrl\":\"https://example.com\"}"))
        .andExpect(status().isUnauthorized());
    assertEquals(0, links.count());
  }

  @Test
  void rejectsAnAuthenticatedRoleOutsideAdminOrUserWithoutStoring() throws Exception {
    mockMvc
        .perform(
            post("/api/links")
                .with(jwt().jwt(token -> token.subject("guest-1").claim("role", "guest")))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"targetUrl\":\"https://example.com\"}"))
        .andExpect(status().isForbidden());
    assertEquals(0, links.count());
  }

  @Test
  void rejectsAnInvalidTargetWithATypedBadRequestAndStoresNothing() throws Exception {
    mockMvc
        .perform(
            post("/api/links")
                .with(jwt().jwt(token -> token.subject("admin-1").claim("role", "admin")))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"targetUrl\":\"http://169.254.169.254/latest/meta-data\"}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.error").value("invalid_target_url"));
    assertEquals(0, links.count());
  }

  @TestConfiguration
  static class ResolverConfiguration {

    @Bean
    @Primary
    TargetResolver testTargetResolver() {
      return host -> {
        if (host.equals("example.com")) {
          return new InetAddress[] {InetAddress.getByName("93.184.216.34")};
        }
        if (host.equals("blocked.example")) {
          return new InetAddress[] {InetAddress.getByName("10.0.0.5")};
        }
        return InetAddress.getAllByName(host);
      };
    }
  }
}
