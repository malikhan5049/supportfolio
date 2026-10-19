package com.supportfolio.platform.identity.provider;

import com.supportfolio.platform.identity.IdentityProperties;
import com.supportfolio.platform.identity.principal.ExternalIdentity;
import com.supportfolio.platform.identity.principal.IdentityProvider;
import org.springframework.http.HttpStatusCode;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

public class GitHubIdentityProvider implements IdentityProvider {

  private final RestClient gitHubApi;
  private final JsonMapper objectMapper = JsonMapper.builder().build();

  public GitHubIdentityProvider(RestClient.Builder builder, IdentityProperties identityProperties) {
    this.gitHubApi =
        builder
            .baseUrl(identityProperties.githubApiBaseUrl())
            .defaultHeader("Accept", "application/vnd.github+json")
            .defaultStatusHandler(
                HttpStatusCode::isError,
                (request, response) -> {
                  // Never include the Authorization header (access token) in the message.
                  throw new IllegalStateException(
                      "GitHub API request to "
                          + request.getURI().getPath()
                          + " failed with status "
                          + response.getStatusCode().value());
                })
            .build();
  }

  @Override
  public ExternalIdentity fetch(String accessToken) {
    JsonNode user = getJson("/user", accessToken);
    JsonNode emails = getJson("/user/emails", accessToken);
    return new ExternalIdentity(
        requiredField(user, "id"),
        requiredField(user, "login"),
        primaryVerifiedEmail(emails),
        displayName(user));
  }

  private JsonNode getJson(String path, String accessToken) {
    String body =
        gitHubApi
            .get()
            .uri(path)
            .header("Authorization", "Bearer " + accessToken)
            .retrieve()
            .body(String.class);
    if (body == null || body.isBlank()) {
      throw new IllegalStateException("GitHub API returned an empty response body for " + path);
    }
    return objectMapper.readTree(body);
  }

  private static String requiredField(JsonNode node, String field) {
    JsonNode value = node.path(field);
    if (value.isMissingNode() || value.isNull()) {
      throw new IllegalStateException(
          "GitHub API response is missing required field '" + field + "'");
    }
    return value.asString();
  }

  private static String primaryVerifiedEmail(JsonNode emails) {
    if (!emails.isArray()) {
      return null;
    }
    for (JsonNode email : emails) {
      if (email.path("primary").asBoolean(false) && email.path("verified").asBoolean(false)) {
        JsonNode address = email.path("email");
        if (address.isString()) {
          return address.asString();
        }
      }
    }
    return null;
  }

  private static String displayName(JsonNode user) {
    JsonNode name = user.path("name");
    if (name.isMissingNode() || name.isNull()) {
      return requiredField(user, "login");
    }
    return name.asString();
  }
}
