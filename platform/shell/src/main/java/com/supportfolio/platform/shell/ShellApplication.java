package com.supportfolio.platform.shell;

import com.supportfolio.platform.shell.registry.RemoteRegistryProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(RemoteRegistryProperties.class)
public class ShellApplication {

  public static void main(String[] args) {
    SpringApplication.run(ShellApplication.class, args);
  }
}
