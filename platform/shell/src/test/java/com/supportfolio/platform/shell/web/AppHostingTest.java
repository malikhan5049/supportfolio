package com.supportfolio.platform.shell.web;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class AppHostingTest {
  @Autowired MockMvc mvc;

  @Test
  void servesIndexWithTrailingSlash() throws Exception {
    mvc.perform(get("/apps/tinyurl/"))
        .andExpect(status().isOk())
        .andExpect(content().string(containsString("tinyurl-index")));
  }

  @Test
  void redirectsMissingTrailingSlash() throws Exception {
    mvc.perform(get("/apps/tinyurl"))
        .andExpect(status().is3xxRedirection())
        .andExpect(header().string("Location", "/apps/tinyurl/"));
  }

  @Test
  void servesDeepLinksFromIndex() throws Exception {
    mvc.perform(get("/apps/tinyurl/browse/anything"))
        .andExpect(status().isOk())
        .andExpect(content().string(containsString("tinyurl-index")));
  }

  @Test
  void missingAssetStays404() throws Exception {
    mvc.perform(get("/apps/tinyurl/missing.js")).andExpect(status().isNotFound());
  }

  @Test
  void robotsTxtIsServedAnonymously() throws Exception {
    mvc.perform(get("/robots.txt"))
        .andExpect(status().isOk())
        .andExpect(content().string(containsString("Disallow: /")));
  }

  @Test
  void noindexHeaderIsPresent() throws Exception {
    mvc.perform(get("/apps/tinyurl/")).andExpect(header().string("X-Robots-Tag", "noindex"));
  }
}
