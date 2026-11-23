import { expect, test } from '@playwright/test';

test('a dead remote entry renders the offline tile while the live remote still works', async ({
  page,
}) => {
  await page.goto('/');

  // The e2e registry fixture points `dead-remote` at a closed port, so its card fails to load.
  const deadCell = page.getByTestId('project-card-dead-remote');
  await expect(deadCell).toContainText('Dead Remote');

  const offlineTile = deadCell.getByTestId('remote-card-offline');
  await expect(offlineTile).toBeVisible();
  await expect(offlineTile.getByRole('status')).toHaveText('Offline');
  // The offline tile has no Open action: the shell cannot open a project whose module failed.
  await expect(deadCell.getByTestId('open-action')).toHaveCount(0);

  // The second entry must not disturb the live remote-backed card.
  await expect(page.getByTestId('remote-card-tinyurl')).toBeVisible();
  await expect(page.getByTestId('tinyurl-card-content')).toBeVisible();
});
