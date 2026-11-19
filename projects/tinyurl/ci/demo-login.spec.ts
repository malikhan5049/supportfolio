import { expect, test } from '@playwright/test';

test('the demo stack serves the shell, signs in via demo login, shortens, and counts clicks', async ({
  page,
}) => {
  // The shell SPA at / exposes the TinyURL card.
  await page.goto('/');
  await expect(page.getByTestId('project-card-tinyurl')).toBeVisible();

  // Open the TinyURL micro-frontend.
  await page.goto('/apps/tinyurl/');
  await expect(page.getByTestId('browse-empty').or(page.getByTestId('browse-list'))).toBeVisible();

  // Anonymous browse works; protected POST is refused.
  const anonPost = await page.request.post('/apps/tinyurl/api/links', {
    data: { targetUrl: 'https://example.com/tinyurl-e2e' },
  });
  expect(anonPost.status()).toBe(401);

  // Demo sign-in flow.
  await page.goto('/signin');
  await expect(page.getByTestId('demo-sign-in')).toBeVisible();
  await page.getByTestId('demo-sign-in').click();
  await page.waitForURL('/');
  await page.goto('/apps/tinyurl/');
  await expect(page.getByTestId('signed-in-as')).toHaveText('Demo Reviewer');

  // Shorten through the demo stack: same-origin /apps/tinyurl/api/links, absolute /go link.
  await page.fill('[data-testid="target-url"]', 'https://example.com/tinyurl-e2e');
  await page.getByTestId('shorten-submit').click();
  await expect(page.getByTestId('short-link')).toBeVisible();
  const shortHref = await page.getByTestId('short-link').getAttribute('href');
  expect(shortHref).toMatch(/^http:\/\/localhost:18080\/go\//);

  // Trigger the redirect twice; the public count reflects both.
  const slug = (shortHref ?? '').split('/go/')[1] ?? '';
  await page.request.get(shortHref!, { maxRedirects: 0 });
  await page.request.get(shortHref!, { maxRedirects: 0 });
  await page.goto('/apps/tinyurl/');
  await expect(page.getByTestId('browse-list')).toBeVisible();
  await expect(page.getByTestId(`click-count-${slug}`)).toContainText('2');
});
