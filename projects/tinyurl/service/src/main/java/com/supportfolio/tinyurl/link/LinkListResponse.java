package com.supportfolio.tinyurl.link;

import java.util.List;

/** Browse response shape shared by the REST endpoint and the SPA. */
public record LinkListResponse(List<LinkView> links) {}
