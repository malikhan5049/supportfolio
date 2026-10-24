package com.supportfolio.tinyurl.link;

import java.net.InetAddress;
import java.net.UnknownHostException;

/** Resolves a host name to every address it maps to; the mockability seam for validation. */
@FunctionalInterface
public interface TargetResolver {

  InetAddress[] resolve(String host) throws UnknownHostException;
}
