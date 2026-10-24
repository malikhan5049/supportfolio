import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './src',
  reporter: 'list',
  timeout: 180_000,
  use: { baseURL: 'http://localhost:4200' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: [
    {
      command: 'npx nx serve tinyurl-microfrontend --port 4201 --configuration=development',
      url: 'http://localhost:4201/remoteEntry.js',
      timeout: 180_000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npx nx serve shell-host --port 4200 --configuration=e2e',
      url: 'http://localhost:4200',
      timeout: 180_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
