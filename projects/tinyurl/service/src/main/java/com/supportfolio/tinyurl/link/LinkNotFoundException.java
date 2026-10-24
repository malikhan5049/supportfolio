package com.supportfolio.tinyurl.link;

/** Unknown slug on a redirect follow; mapped to {@code 404 {"error":"link_not_found"}}. */
public class LinkNotFoundException extends RuntimeException {

  public LinkNotFoundException(String slug) {
    super("no link for slug " + slug);
  }
}
