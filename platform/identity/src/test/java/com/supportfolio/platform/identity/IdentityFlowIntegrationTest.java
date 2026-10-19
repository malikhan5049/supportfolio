package com.supportfolio.platform.identity;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.jayway.jsonpath.JsonPath;
import com.nimbusds.jose.crypto.RSASSAVerifier;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jwt.SignedJWT;
import java.io.IOException;
import java.net.CookieManager;
import java.net.InetAddress;
import java.net.URI;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.time.Duration;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import okhttp3.mockwebserver.Dispatcher;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * The whole login contract in one run against a real HTTP server: the browser-facing redirect
 * dance, GitHub's OAuth2 exchange (stubbed by {@link MockWebServer}), the one-time code hand-off,
 * the token exchange, and a JWT verified against the live {@code /oauth2/jwks} endpoint. This is
 * the net the Angular auth client is built on.
 *
 * <p>The flow crosses real redirects between two hosts (identity and the GitHub stand-in), so the
 * test drives a real {@link HttpClient} with its own {@link CookieManager} instead of MockMvc.
 * Redirects are followed hop by hop with {@link HttpClient.Redirect#NEVER} so every hop is asserted
 * and the final redirect to the (nonexistent) frontend origin is never actually requested.
 */
@SpringBootTest(
    properties = {
      "spring.security.oauth2.client.registration.github.client-id=test-client",
      "spring.security.oauth2.client.registration.github.client-secret=test-secret"
    },
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class IdentityFlowIntegrationTest {

  private static final String ISSUER = "http://localhost:8081";
  private static final String ALLOWED_ORIGIN = "http://localhost:4200";
  private static final String LOGIN = "octocat";
  private static final String GITHUB_CODE = "gh-code";
  private static final String GITHUB_TOKEN = "gh-token";
  private static final Duration HTTP_TIMEOUT = Duration.ofSeconds(10);

  /**
   * GitHub stand-in; started before the context so {@code @DynamicPropertySource} sees its port.
   * Bound explicitly to the loopback because on this machine {@code getHostName()} reverse-resolves
   * to {@code host.docker.internal}, whose URL blackholes; {@code localhost} plus the port is the
   * reliable address ({@link #githubBase()}).
   */
  private static final MockWebServer GITHUB = startMockGitHub();

  private static MockWebServer startMockGitHub() {
    MockWebServer server = new MockWebServer();
    server.setDispatcher(new GitHubStub());
    try {
      server.start(InetAddress.getByName("127.0.0.1"), 0);
    } catch (IOException e) {
      throw new IllegalStateException("Failed to start the mock GitHub server", e);
    }
    return server;
  }

  @AfterAll
  static void shutDownMockGitHub() throws IOException {
    GITHUB.shutdown();
  }

  @DynamicPropertySource
  static void identityProperties(DynamicPropertyRegistry registry) throws Exception {
    KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
    generator.initialize(2048);
    KeyPair keyPair = generator.generateKeyPair();
    registry.add("supportfolio.identity.issuer", () -> ISSUER);
    registry.add("supportfolio.identity.admin-login", () -> "owner");
    registry.add("supportfolio.identity.allowlist", () -> LOGIN);
    registry.add("supportfolio.identity.redirect-origins", () -> ALLOWED_ORIGIN);
    registry.add("supportfolio.identity.jwt-private-key-pem", () -> pem(keyPair.getPrivate()));
    // Wire the whole GitHub surface to the mock server: the OAuth2 provider endpoints the
    // browser dance follows, and the API base the provider adapter calls for the profile.
    String github = githubBase();
    registry.add("supportfolio.identity.github-api-base-url", () -> github);
    registry.add(
        "spring.security.oauth2.client.provider.github.authorization-uri",
        () -> github + "/login/oauth/authorize");
    registry.add(
        "spring.security.oauth2.client.provider.github.token-uri",
        () -> github + "/login/oauth/access_token");
    registry.add(
        "spring.security.oauth2.client.provider.github.user-info-uri", () -> github + "/user");
  }

  @LocalServerPort private int identityPort;

  @Test
  void loginMintsAOneTimeCodeThatExchangesForAJwtVerifiedAgainstTheLiveJwks() throws Exception {
    HttpClient browser = browserClient();
    String identity = "http://localhost:" + identityPort;

    // Step 1: an allowed-origin login entry point opens the session and starts the dance.
    HttpResponse<String> loginEntry =
        send(browser, identity + "/auth/login?redirect=" + urlEncode(ALLOWED_ORIGIN + "/app"));
    assertEquals(302, loginEntry.statusCode(), "the login entry point must redirect");
    assertEquals("/oauth2/authorization/github", locationOf(loginEntry));
    assertTrue(
        loginEntry.headers().allValues("set-cookie").stream()
            .anyMatch(cookie -> cookie.startsWith("JSESSIONID=")),
        "the login entry point must open the session the dance continues");

    // Step 2a: the OAuth2 entry point 302s to GitHub's (mocked) authorize endpoint.
    HttpResponse<String> danceStart = send(browser, identity + locationOf(loginEntry));
    assertEquals(302, danceStart.statusCode(), "the OAuth2 entry point must redirect to GitHub");
    String authorizeUrl = locationOf(danceStart);
    assertTrue(
        authorizeUrl.startsWith(githubBase() + "/login/oauth/authorize"),
        "expected a redirect to the mock GitHub authorize endpoint but got: " + authorizeUrl);
    String state = queryParams(authorizeUrl).get("state");

    // Step 2b: at GitHub the authorize page 302s back to the identity callback, echoing the
    // state and attaching GitHub's code.
    HttpResponse<String> authorize = send(browser, authorizeUrl);
    assertEquals(302, authorize.statusCode(), "GitHub must return the code to the callback");
    String callbackUrl = locationOf(authorize);
    assertTrue(
        callbackUrl.startsWith(identity + "/login/oauth2/code/github"),
        "GitHub must send the code back to the identity callback but got: " + callbackUrl);
    Map<String, String> callbackParams = queryParams(callbackUrl);
    assertEquals(GITHUB_CODE, callbackParams.get("code"));
    assertEquals(state, callbackParams.get("state"), "GitHub must echo the state parameter");

    // Step 2c: the callback (same session) completes the dance: the final 302 carries the
    // one-time code to the validated frontend target.
    HttpResponse<String> callback = send(browser, callbackUrl);
    assertEquals(302, callback.statusCode(), "a successful callback must hand off to the app");
    String finalLocation = locationOf(callback);
    String expectedPrefix = ALLOWED_ORIGIN + "/app?code=";
    assertTrue(
        finalLocation.startsWith(expectedPrefix),
        "expected the one-time code hand-off to " + ALLOWED_ORIGIN + " but got: " + finalLocation);
    String oneTimeCode = finalLocation.substring(expectedPrefix.length());

    // Step 3: the frontend never loads the redirect target; it exchanges the code for a token.
    HttpRequest tokenRequest =
        HttpRequest.newBuilder(URI.create(identity + "/api/token"))
            .timeout(HTTP_TIMEOUT)
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString("{\"code\":\"" + oneTimeCode + "\"}"))
            .build();
    HttpResponse<String> tokenResponse =
        browser.send(tokenRequest, HttpResponse.BodyHandlers.ofString());
    assertEquals(200, tokenResponse.statusCode(), "the code must exchange for a token");
    String body = tokenResponse.body();
    assertEquals("Bearer", JsonPath.read(body, "$.tokenType"));
    assertEquals(3600, ((Number) JsonPath.read(body, "$.expiresIn")).intValue());
    assertEquals("123", JsonPath.read(body, "$.principal.id"));
    assertEquals(LOGIN, JsonPath.read(body, "$.principal.login"));
    assertEquals("a@x.com", JsonPath.read(body, "$.principal.email"));
    assertEquals("The Octocat", JsonPath.read(body, "$.principal.displayName"));
    assertEquals("user", JsonPath.read(body, "$.principal.role"));

    // Step 4: the token is a JWT verifiable against the LIVE JWKS endpoint of this server.
    HttpResponse<String> jwksResponse = send(browser, identity + "/oauth2/jwks");
    assertEquals(200, jwksResponse.statusCode());
    JWKSet jwkSet = JWKSet.parse(jwksResponse.body());
    assertEquals(1, jwkSet.getKeys().size());
    RSAKey publishedKey = jwkSet.getKeys().get(0).toRSAKey();
    SignedJWT jwt = SignedJWT.parse((String) JsonPath.read(body, "$.accessToken"));
    assertTrue(
        jwt.verify(new RSASSAVerifier(publishedKey.toRSAPublicKey())),
        "the token signature must verify against the live JWKS endpoint");
    assertEquals(publishedKey.getKeyID(), jwt.getHeader().getKeyID());
    assertEquals(ISSUER, jwt.getJWTClaimsSet().getIssuer());
    assertEquals("123", jwt.getJWTClaimsSet().getSubject());
    assertEquals(LOGIN, jwt.getJWTClaimsSet().getClaim("preferred_username"));
    assertEquals("user", jwt.getJWTClaimsSet().getClaim("role"));
  }

  /**
   * A real browser client: its own in-memory cookie handler so the session opened in step 1 rides
   * along to the callback, and {@code NEVER} redirects so each hop is asserted and the final
   * redirect to the (nonexistent) frontend origin is never followed.
   */
  private static HttpClient browserClient() {
    return HttpClient.newBuilder()
        .followRedirects(HttpClient.Redirect.NEVER)
        .cookieHandler(new CookieManager())
        .connectTimeout(HTTP_TIMEOUT)
        .build();
  }

  private static HttpResponse<String> send(HttpClient browser, String url)
      throws IOException, InterruptedException {
    HttpRequest request =
        HttpRequest.newBuilder(URI.create(url)).timeout(HTTP_TIMEOUT).GET().build();
    return browser.send(request, HttpResponse.BodyHandlers.ofString());
  }

  private static String locationOf(HttpResponse<String> response) {
    return response
        .headers()
        .firstValue("Location")
        .orElseThrow(() -> new AssertionError("expected a Location header, got no header"));
  }

  private static String githubBase() {
    // Never GITHUB.getHostName(): on this machine it reverse-resolves to host.docker.internal,
    // whose URL blackholes; the mock always listens on the loopback it was explicitly bound to.
    return "http://localhost:" + GITHUB.getPort();
  }

  private static Map<String, String> queryParams(String url) {
    Map<String, String> params = new HashMap<>();
    String rawQuery = URI.create(url).getRawQuery();
    if (rawQuery == null) {
      return params;
    }
    for (String pair : rawQuery.split("&")) {
      int separator = pair.indexOf('=');
      String name = separator < 0 ? pair : pair.substring(0, separator);
      String value = separator < 0 ? "" : pair.substring(separator + 1);
      params.put(
          URLDecoder.decode(name, StandardCharsets.UTF_8),
          URLDecoder.decode(value, StandardCharsets.UTF_8));
    }
    return params;
  }

  private static String urlEncode(String value) {
    return URLEncoder.encode(value, StandardCharsets.UTF_8);
  }

  private static String pem(PrivateKey privateKey) {
    String body =
        Base64.getMimeEncoder(64, new byte[] {'\n'}).encodeToString(privateKey.getEncoded());
    return "-----BEGIN PRIVATE KEY-----\n" + body + "\n-----END PRIVATE KEY-----\n";
  }

  /**
   * GitHub stand-in answering by path: the authorize page echoes the requested {@code state} back
   * to the {@code redirect_uri} with GitHub's code attached, the token endpoint answers the
   * exchange, and the API serves the allowlisted user's profile and emails.
   */
  private static final class GitHubStub extends Dispatcher {

    @Override
    public MockResponse dispatch(RecordedRequest request) {
      String path = request.getPath() == null ? "" : request.getPath();
      int queryIndex = path.indexOf('?');
      String route = queryIndex < 0 ? path : path.substring(0, queryIndex);
      if ("/login/oauth/authorize".equals(route)) {
        Map<String, String> params = queryParams("http://github.stub" + path);
        String state = URLEncoder.encode(params.getOrDefault("state", ""), StandardCharsets.UTF_8);
        return new MockResponse()
            .setResponseCode(302)
            .setHeader(
                "Location",
                params.get("redirect_uri") + "?code=" + GITHUB_CODE + "&state=" + state);
      }
      if ("/login/oauth/access_token".equals(route)) {
        return json(
            "{\"access_token\":\""
                + GITHUB_TOKEN
                + "\",\"token_type\":\"bearer\",\"scope\":\"read:user,user:email\"}");
      }
      if ("/user".equals(route)) {
        return json("{\"id\":123,\"login\":\"octocat\",\"name\":\"The Octocat\"}");
      }
      if ("/user/emails".equals(route)) {
        return json(
            "[{\"email\":\"a@x.com\",\"primary\":true,\"verified\":true,\"visibility\":\"private\"}]");
      }
      return new MockResponse().setResponseCode(404);
    }

    private static MockResponse json(String body) {
      return new MockResponse()
          .setResponseCode(200)
          .setHeader("Content-Type", "application/json")
          .setBody(body);
    }
  }
}
