import { expect, test } from '@playwright/test';

test('the shell renders the real TinyURL remote from the runtime registry', async ({ page }) => {
  await page.goto('/');
  const card = page.getByTestId('project-card-tinyurl');
  await expect(card).toContainText('TinyURL');
  await expect(page.getByTestId('remote-card-tinyurl')).toBeVisible(); // remote-only wrapper id
  await expect(page.getByTestId('tinyurl-card-content')).toBeVisible(); // real-card content signal
  await expect(page.getByTestId('open-action')).toBeVisible();

  const popup = page.waitForEvent('popup');
  await page.getByTestId('open-action').click();
  await expect(await popup).toHaveURL(/^http:\/\/localhost:4201\//); // acceptance #2: its own origin
});
