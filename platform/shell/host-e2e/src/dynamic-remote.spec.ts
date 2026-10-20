import { test, expect } from '@playwright/test';

test('the shell renders a card loaded from the runtime registry', async ({ page }) => {
  await page.goto('/');
  const card = page.getByTestId('project-card-identity');
  await expect(card).toContainText('Identity');
  await expect(card).toContainText('GitHub sign-in');
  await expect(page.getByTestId('remote-card-identity')).toBeVisible(); // remote code, not the fallback
});
