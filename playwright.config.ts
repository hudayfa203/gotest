import { defineConfig } from '@playwright/test';

/**
 * Visual check of the app's WEB PREVIEW (react-native-web) at iPhone size. The real deliverables are the
 * native iOS/Android apps; this only renders the same screens in Chromium for screenshots.
 *   EXPO_PUBLIC_API_URL=http://localhost:3100/api/v1 npx expo export --platform web --output-dir dist-web
 *   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:8089',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'en-GB',
    timezoneId: 'Africa/Nairobi',
  },
  webServer: {
    command: 'node e2e/serve.js dist-web 8089',
    url: 'http://localhost:8089',
    reuseExistingServer: true,
  },
});
