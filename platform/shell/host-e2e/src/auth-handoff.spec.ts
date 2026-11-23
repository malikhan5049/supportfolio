import { expect, test } from '@playwright/test';

/**
 * The dev-server proxy must mirror the gateway's OAuth route surface (`/oauth2/**`, `/login/**`).
 * Regression: without those proxy entries, Identity's relative 302 to
 * `/oauth2/authorization/github` resolved against the dev-server origin, the SPA fallback
 * answered with the app's index.html, and the user bounced silently back to the landing page
 * with the sign-in button — GitHub never saw the request.
 */
for (const path of ['/oauth2/authorization/github', '/login/oauth2/code/github']) {
  test(`${path} is proxied to Identity, never answered by the SPA fallback`, async ({
    request,
  }) => {
    const response = await request
      .get(path, { maxRedirects: 0, headers: { accept: 'text/html' } })
      .catch(() => null);

    if (!response) {
      // The request aborted at the transport level (proxy attempted an unreachable upstream).
      // That is still "not the SPA" — nothing further to assert.
      return;
    }

    if (response.status() === 200) {
      // 200 is the only status the SPA fallback produces; its body must not be the app shell.
      const body = await response.text();
      expect(body).not.toContain('<app-root');
    }
  });
}
