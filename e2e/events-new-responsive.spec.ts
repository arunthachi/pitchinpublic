import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import {
  captureBrowserErrors,
  expectNoDocumentHorizontalOverflow,
  settleResponsiveLayout,
} from './support/page-health';

// Generate an authenticated organizer storage state locally and keep it outside
// source control (for example, .playwright-cli/organizer-state.json). Set
// PLAYWRIGHT_ORGANIZER_STORAGE_STATE to that file. Its cookies must match
// PLAYWRIGHT_BASE_URL (or the local server origin). Never commit the state file.
const configuredStorageState = process.env.PLAYWRIGHT_ORGANIZER_STORAGE_STATE;
const organizerStorageState = configuredStorageState ? resolve(configuredStorageState) : undefined;
const hasOrganizerStorageState = Boolean(organizerStorageState && existsSync(organizerStorageState));

if (hasOrganizerStorageState && organizerStorageState) {
  test.use({ storageState: organizerStorageState });
}

const organizerViewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
] as const;

for (const viewport of organizerViewports) {
  test(`organizer create form stays minimal at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    test.skip(
      !hasOrganizerStorageState,
      'Set PLAYWRIGHT_ORGANIZER_STORAGE_STATE to an uncommitted authenticated organizer fixture to run this test.'
    );

    const context = `/events/new?organizer=accepted at ${viewport.width}x${viewport.height}`;
    const browserErrors = captureBrowserErrors(page);
    await page.setViewportSize(viewport);
    const response = await page.goto('/events/new?organizer=accepted', { waitUntil: 'domcontentloaded' });
    expect(response?.status(), `${context} returned an HTTP error`).toBeLessThan(400);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Create event' }),
      `${context} did not reach the authorized organizer form; verify the fixture's role and origin`
    ).toBeVisible({ timeout: 15_000 });

    await expect(page.getByLabel('Event name')).toBeVisible();
    await expect(page.getByLabel('Pitch day')).toBeVisible();
    await expect(page.getByLabel('Founder emails (optional)')).toBeVisible();
    const advanced = page.getByRole('button', { name: 'Advanced settings' });
    await expect(advanced).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByLabel('Description')).toBeHidden();
    await expect(page.getByText('Pitch Hour', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Reviews in each queue', { exact: true })).toHaveCount(0);

    await advanced.click();
    await page.getByLabel('Description').fill('Keep this value while advanced settings close.');
    await advanced.focus();
    await page.keyboard.press('Escape');
    await expect(advanced).toBeFocused();
    await expect(advanced).toHaveAttribute('aria-expanded', 'false');
    await advanced.click();
    await expect(page.getByLabel('Description')).toHaveValue('Keep this value while advanced settings close.');
    await advanced.click();

    await settleResponsiveLayout(page);
    if (viewport.width === 390 && viewport.height === 844) {
      const createButton = page.getByRole('button', { name: 'Create event' });
      const box = await createButton.boundingBox();
      expect(box, `${context} create button has no layout box`).not.toBeNull();
      if (box) expect(box.y + box.height, `${context} create action is below the first viewport`).toBeLessThanOrEqual(viewport.height + 1);
    }

    await expectNoDocumentHorizontalOverflow(page, context);
    browserErrors.assertNone(context);
  });
}
