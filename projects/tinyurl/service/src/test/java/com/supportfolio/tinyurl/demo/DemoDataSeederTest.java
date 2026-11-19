package com.supportfolio.tinyurl.demo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.supportfolio.tinyurl.PostgresIntegrationTest;
import com.supportfolio.tinyurl.link.LinkClickRepository;
import com.supportfolio.tinyurl.link.LinkRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest(properties = "supportfolio.tinyurl.demo-seed-enabled=true")
// Override the shared base's @Transactional so the seed committed by the ApplicationRunner at
// context startup is visible to these assertions, and so cleanup commits independently of any
// test transaction. This keeps the singleton Testcontainers database tidy even if the base-class
// transaction policy ever changes.
@Transactional(propagation = Propagation.NOT_SUPPORTED)
@AutoConfigureMockMvc
class DemoDataSeederTest extends PostgresIntegrationTest {

  @Autowired LinkRepository links;
  @Autowired LinkClickRepository clicks;
  @Autowired MockMvc mockMvc;

  // The property above enables the DemoDataSeeder bean, which runs as an ApplicationRunner during
  // context startup. There is deliberately no manual seeder.run(null) call and no @BeforeEach
  // cleanup: the rows asserted here can only come from the startup wiring. This class holds a
  // single test method so that the @AfterEach cleanup below cannot erase rows a later test needs.
  @Test
  void seedsFiveLinksWithClicksAtStartup() throws Exception {
    assertThat(links.count()).isEqualTo(5);
    assertThat(clicks.count()).isGreaterThan(0);
    assertThat(links.findAllWithClickCounts()).anyMatch(summary -> summary.getClickCount() > 0);

    mockMvc
        .perform(get("/api/links"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.links.length()").value(5))
        .andExpect(jsonPath("$.links[0].slug").value("docs"))
        .andExpect(jsonPath("$.links[0].clickCount").value(3))
        .andExpect(jsonPath("$.links[2].slug").value("angular"))
        .andExpect(jsonPath("$.links[2].clickCount").value(7));
  }

  @AfterEach
  void tearDown() {
    clicks.deleteAll();
    links.deleteAll();
  }
}
