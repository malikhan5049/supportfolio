package com.supportfolio.tinyurl.link;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.supportfolio.tinyurl.PostgresIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

/** The 429 boundary: cap hit stores nothing; a different user keeps their own budget. */
@SpringBootTest
@TestPropertySource(properties = "supportfolio.tinyurl.rate-limit-per-hour=2")
@AutoConfigureMockMvc
class RateLimitEndpointTest extends PostgresIntegrationTest {

  @Autowired MockMvc mockMvc;
  @Autowired LinkRepository links;

  @Test
  void returns429OnTheThirdShortenAndStoresNothingForIt() throws Exception {
    shorten("capuser", "https://example.com/one", status().isCreated());
    shorten("capuser", "https://example.com/two", status().isCreated());
    mockMvc
        .perform(
            post("/api/links")
                .with(jwt().jwt(j -> j.subject("capuser").claim("role", "admin")))
                .contentType(APPLICATION_JSON)
                .content("{\"targetUrl\":\"https://example.com/three\"}"))
        .andExpect(status().isTooManyRequests())
        .andExpect(jsonPath("$.error").value("rate_limited"));
    assertEquals(2, links.count());
  }

  @Test
  void anotherUserStillHasTheirOwnBudget() throws Exception {
    shorten("budgetuser", "https://example.com/first", status().isCreated());
    shorten("budgetuser", "https://example.com/second", status().isCreated());
    shorten("budgetuser-two", "https://example.com/own", status().isCreated());
    assertEquals(3, links.count());
  }

  private void shorten(
      String user, String target, org.springframework.test.web.servlet.ResultMatcher expected)
      throws Exception {
    mockMvc
        .perform(
            post("/api/links")
                .with(jwt().jwt(j -> j.subject(user).claim("role", "admin")))
                .contentType(APPLICATION_JSON)
                .content("{\"targetUrl\":\"" + target + "\"}"))
        .andExpect(expected);
  }
}
