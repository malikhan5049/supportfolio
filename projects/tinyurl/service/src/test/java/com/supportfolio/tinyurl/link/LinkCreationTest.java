package com.supportfolio.tinyurl.link;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.Map;
import com.supportfolio.tinyurl.PostgresIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.test.web.servlet.MockMvc;

/**
 * The shorten endpoint: admin and allowlisted-user roles may create, anonymous and other roles may
 * not, and nothing is stored for a rejected or invalid request. The resolver bean is replaced with
 * a deterministic one, so tests exercise states rather than DNS.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(LinkCreationTest.ResolverStub.class)
class LinkCreationTest extends PostgresIntegrationTest {

  @Autowired MockMvc mockMvc;
  @Autowired LinkRepository links;

  @Test
  void createsALinkForAnAdminAndStoresTheJwtSubject() throws Exception {
    mockMvc
        .perform(
            post("/api/links")
                .with(jwt().jwt(j -> j.subject("admin-1").claim("role", "admin")))
                .contentType(APPLICATION_JSON)
                .content("{\"targetUrl\":\"https://example.com/a\"}"))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.slug").value(org.hamcrest.Matchers.matchesPattern("[0-9A-Za-z]{8}")))
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
                .with(jwt().jwt(j -> j.subject("user-1").claim("role", "user")))
                .contentType(APPLICATION_JSON)
                .content("{\"targetUrl\":\"https://example.com/b\"}"))
        .andExpect(status().isCreated());
  }

  @Test
  void rejectsAnonymousShorten() throws Exception {
    mockMvc
        .perform(post("/api/links").contentType(APPLICATION_JSON).content("{\"targetUrl\":\"https://example.com\"}"))
        .andExpect(status().isUnauthorized());
    assertEquals(0, links.count());
  }

  @Test
  void rejectsAnAuthenticatedRoleOutsideAdminOrUserWithoutStoring() throws Exception {
    mockMvc
        .perform(
            post("/api/links")
                .with(jwt().jwt(j -> j.subject("guest-1").claim("role", "guest")))
                .contentType(APPLICATION_JSON)
                .content("{\"targetUrl\":\"https://example.com\"}"))
        .andExpect(status().isForbidden());
    assertEquals(0, links.count());
  }

  @Test
  void rejectsAnInvalidTargetWithATypedBadRequestAndStoresNothing() throws Exception {
    mockMvc
        .perform(
            post("/api/links")
                .with(jwt().jwt(j -> j.subject("admin-1").claim("role", "admin")))
                .contentType(APPLICATION_JSON)
                .content("{\"targetUrl\":\"http://169.254.169.254/latest/meta-data\"}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.error").value("invalid_target_url"));
    assertEquals(0, links.count());
  }

  @TestConfiguration
  static class ResolverStub {

    @Bean
    @Primary
    TargetResolver blockedTestResolver() {
      Map<String, InetAddress[]> addresses = addresses();
      return host -> {
        InetAddress[] found = addresses.get(host);
        if (found == null) {
          throw new UnknownHostException(host);
        }
        return found;
      };
    }

    private static Map<String, InetAddress[]> addresses() {
      try {
        return Map.of(
            "example.com", new InetAddress[] {InetAddress.getByName("93.184.216.34")},
            "loopback.example", new InetAddress[] {InetAddress.getByName("127.0.0.1")});
      } catch (UnknownHostException e) {
        throw new IllegalStateException(e);
      }
    }
  }
}
