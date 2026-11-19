package com.supportfolio.platform.shell.web;

import java.io.IOException;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.Resource;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;

@Configuration
public class AppHostingConfig implements WebMvcConfigurer {

  @Override
  public void addResourceHandlers(ResourceHandlerRegistry registry) {
    registry
        .addResourceHandler("/apps/**")
        .addResourceLocations("classpath:/static/apps/", "file:/app/static/apps/")
        .resourceChain(true)
        .addResolver(new AppIndexFallbackResolver());
  }

  static class AppIndexFallbackResolver extends PathResourceResolver {
    @Override
    protected Resource getResource(String resourcePath, Resource location) throws IOException {
      Resource resource = super.getResource(resourcePath, location);
      if (resource != null && resource.exists()) {
        return resource;
      }
      if (!resourcePath.contains(".")) {
        String appId = resourcePath.split("/")[0];
        return super.getResource(appId + "/index.html", location);
      }
      return null;
    }
  }
}
