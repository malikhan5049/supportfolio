package com.supportfolio.platform.shell.registry;

import java.util.List;

/** One project as advertised by the remote registry; the shell card renders from this. */
public record RemoteProject(
    String id,
    String displayName,
    String shortDescription,
    List<String> features,
    String openUrl,
    List<ExposedModule> exposedModules) {}
