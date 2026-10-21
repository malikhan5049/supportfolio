package com.supportfolio.tinyurl.link;

/** The only field the client sends when shortening. */
public record CreateLinkRequest(String targetUrl) {}
