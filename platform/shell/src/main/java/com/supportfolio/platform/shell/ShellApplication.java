package com.supportfolio.platform.shell;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import com.supportfolio.platform.shell.registry.RemoteRegistryProperties;

@SpringBootApplication
@EnableConfigurationProperties(RemoteRegistryProperties.class)
public class ShellApplication {

  public static void main(String[] args) {
    SpringApplication.run(ShellApplication.class, args);
  }
}
