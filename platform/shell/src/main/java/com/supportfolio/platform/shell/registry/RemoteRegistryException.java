package com.supportfolio.platform.shell.registry;

/** The remote registry file is missing or unparsable; callers answer 503 registry_unavailable. */
public class RemoteRegistryException extends RuntimeException {

  public RemoteRegistryException(String message) {
    super(message);
  }

  public RemoteRegistryException(String message, Throwable cause) {
    super(message, cause);
  }
}
