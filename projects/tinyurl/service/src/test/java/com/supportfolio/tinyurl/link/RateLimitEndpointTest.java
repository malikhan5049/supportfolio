package com.supportfolio.tinyurl.link;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.supportfolio.tinyurl.PostgresIntegrationTest;
import java.net.InetAddress;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest(properties = "supportfolio.tinyurl.rate-limit-per-hour=2")
@AutoConfigureMockMvc
@Import(RateLimitEndpointTest.ResolverConfiguration.class)
@Transactional
class RateLimitEndpointTest extends PostgresIntegrationTest {

  @Autowired MockMvc mockMvc;
  @Autowired LinkRepository links;

  @Test
  void returns429OnTheThirdShortenAndStoresNothingForIt() throws Exception {
    create("admin-1").andExpect(status().isCreated());
    create("admin-1").andExpect(status().isCreated());
    create("admin-1")
        .andExpect(status().isTooManyRequests())
        .andExpect(jsonPath("$.error").value("rate_limited"));

    org.junit.jupiter.api.Assertions.assertEquals(2, links.count());
  }

  @Test
  void anotherUserStillHasTheirOwnBudget() throws Exception {
    create("admin-2").andExpect(status().isCreated());
  }

  private org.springframework.test.web.servlet.ResultActions create(String subject)
      throws Exception {
    return mockMvc.perform(
        post("/api/links")
            .with(jwt().jwt(token -> token.subject(subject).claim("role", "admin")))
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"targetUrl\":\"https://example.com/a\"}"));
  }

  @TestConfiguration
  static class ResolverConfiguration {

    @Bean
    @Primary
    TargetResolver rateLimitTestTargetResolver() {
      return host -> new InetAddress[] {InetAddress.getByName("93.184.216.34")};
    }
  }
}
