package com.supportfolio.platform.shell.registry;

/** One module a project exposes to the shell, with its version and remote entry URL. */
public record ExposedModule(String name, String version, String remoteEntry) {}
