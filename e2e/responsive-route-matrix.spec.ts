import { expect, test } from '@playwright/test';
import {
  captureBrowserErrors,
  expectNoDocumentHorizontalOverflow,
  settleResponsiveLayout,
} from './support/page-health';

const viewports = [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
] as const;

const publicRoutes = [
  { name: 'about', path: '/about', heading: /A pitch gym for founders/i },
  { name: 'contact', path: '/contact', heading: /Questions or event rooms/i },
  { name: 'terms', path: '/terms', heading: /Use Pitch in Public constructively/i },
  { name: 'founders', path: '/founders', heading: /Post your pitch.*Get useful feedback/i },
  { name: 'organizers', path: '/for-events', heading: /Turn your founder program into guided pitch practice/i },
] as const;

for (const route of publicRoutes) {
  for (const viewport of viewports) {
    test(`${route.name} is healthy at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      const context = `${route.path} at ${viewport.width}x${viewport.height}`;
      const browserErrors = captureBrowserErrors(page);
      await page.setViewportSize(viewport);

      const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      expect(response, `${context} did not return a navigation response`).not.toBeNull();
      expect(response?.status(), `${context} returned an HTTP error`).toBeLessThan(400);

      const main = page.locator('main').first();
      const primaryHeading = page.getByRole('heading', { level: 1, name: route.heading }).first();
      await expect(main, `${context} primary content container is hidden`).toBeVisible();
      await expect(primaryHeading, `${context} primary heading is hidden`).toBeVisible();
      await expect(primaryHeading, `${context} primary heading starts outside the viewport`).toBeInViewport({ ratio: 0.25 });

      await settleResponsiveLayout(page);
      await expectNoDocumentHorizontalOverflow(page, context);
      browserErrors.assertNone(context);
    });
  }
}
