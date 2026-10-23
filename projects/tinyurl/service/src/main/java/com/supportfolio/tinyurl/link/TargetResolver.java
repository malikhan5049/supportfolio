package com.supportfolio.tinyurl.link;

import java.net.InetAddress;
import java.net.UnknownHostException;

@FunctionalInterface
public interface TargetResolver {

  InetAddress[] resolve(String host) throws UnknownHostException;
}
