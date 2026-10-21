import { expect, test } from '@playwright/test';

test('the prod bundle serves, logs in through stub identity, shortens, and counts clicks', async ({
  page,
}) => {
  // Anonymous browse works; protected POST is refused.
  await page.goto('/');
  await expect(page.getByTestId('browse-empty').or(page.getByTestId('browse-list'))).toBeVisible();
  const anonPost = await page.request.post('/api/links', {
    data: { targetUrl: 'https://example.com/tinyurl-e2e' },
  });
  expect(anonPost.status()).toBe(401);

  // /signin walks the stub Identity; the callback swaps the code for a session.
  await page.getByTestId('sign-in-link').click();
  await page.getByRole('button', { name: 'Sign in with GitHub' }).click();
  await page.waitForURL(/auth\/callback/);
  await page.goto('/');
  await expect(page.getByTestId('signed-in-as')).toHaveText('Stub User');

  // Shorten through the prod bundle: same-origin /api/links, same-origin /go link.
  await page.fill('[data-testid="target-url"]', 'https://example.com/tinyurl-e2e');
  await page.getByTestId('shorten-submit').click();
  await expect(page.getByTestId('short-link')).toBeVisible();
  const shortHref = await page.getByTestId('short-link').getAttribute('href');

  // Two follows, two click rows, public count reflects both.
  const slug = (shortHref ?? '').split('/go/')[1] ?? '';
  await page.request.get(shortHref!, { maxRedirects: 0 });
  await page.request.get(shortHref!, { maxRedirects: 0 });
  await page.goto('/');
  await expect(page.getByTestId('browse-list')).toBeVisible();
  await expect(page.getByTestId(`click-count-${slug}`)).toContainText('2');
});
