import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  reporter: 'list',
  timeout: 60_000,
  use: { baseURL: 'http://localhost:18088' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
