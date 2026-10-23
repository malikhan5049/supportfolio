package com.supportfolio.tinyurl.link;

public class LinkNotFoundException extends RuntimeException {

  public LinkNotFoundException(String slug) {
    super("No link exists for slug " + slug);
  }
}
