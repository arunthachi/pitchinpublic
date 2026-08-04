import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Locator } from '@playwright/test';
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

const LONG_EMAIL = 'organizer-with-an-intentionally-long-mobile-regression-address@founders-community.example';
const LONG_ROLE = 'Organizer enabled for regional founder-program administration';

async function expectContained(value: Locator, container: Locator, context: string) {
  const [valueBox, containerBox, scrollMetrics] = await Promise.all([
    value.boundingBox(),
    container.boundingBox(),
    value.evaluate((element) => ({ scrollWidth: element.scrollWidth, clientWidth: element.clientWidth })),
  ]);

  expect(valueBox, `${context} value has no layout box`).not.toBeNull();
  expect(containerBox, `${context} container has no layout box`).not.toBeNull();
  expect(scrollMetrics.scrollWidth, `${context} value does not wrap within its own box`).toBeLessThanOrEqual(
    scrollMetrics.clientWidth + 1
  );

  if (valueBox && containerBox) {
    expect(valueBox.x, `${context} escapes the container's left edge`).toBeGreaterThanOrEqual(containerBox.x - 1);
    expect(valueBox.x + valueBox.width, `${context} escapes the container's right edge`).toBeLessThanOrEqual(
      containerBox.x + containerBox.width + 1
    );
  }
}

function boxesOverlap(a: { x: number; y: number; width: number; height: number }, b: typeof a) {
  return !(
    a.x + a.width <= b.x + 1 ||
    b.x + b.width <= a.x + 1 ||
    a.y + a.height <= b.y + 1 ||
    b.y + b.height <= a.y + 1
  );
}

for (const viewport of organizerViewports) {
  test(`organizer account long values stay contained at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    test.skip(
      !hasOrganizerStorageState,
      'Set PLAYWRIGHT_ORGANIZER_STORAGE_STATE to an uncommitted authenticated organizer fixture to run this test.'
    );

    const context = `/events/new?organizer=accepted at ${viewport.width}x${viewport.height}`;
    const browserErrors = captureBrowserErrors(page);
    await page.setViewportSize(viewport);
    await page.addInitScript(
      ({ email }) => {
        window.sessionStorage.setItem(
          'pip.organizer-invite-accepted',
          JSON.stringify({ email, organizationName: 'International Founder Community and Innovation Program' })
        );
      },
      { email: LONG_EMAIL }
    );

    const response = await page.goto('/events/new?organizer=accepted', { waitUntil: 'domcontentloaded' });
    expect(response?.status(), `${context} returned an HTTP error`).toBeLessThan(400);
    await expect(
      page.getByRole('heading', { level: 1, name: /Create the room founders practice toward/i }),
      `${context} did not reach the authorized organizer form; verify the fixture's role and origin`
    ).toBeVisible({ timeout: 15_000 });

    const signedInLabel = page.getByText('Signed in', { exact: true });
    const roleLabel = page.getByText('Role', { exact: true });
    const signedInCell = signedInLabel.locator('..');
    const roleCell = roleLabel.locator('..');
    const signedInValue = signedInCell.locator('p').nth(1);
    const roleValue = roleCell.locator('p').nth(1);

    // Mutating only the visible values makes the CSS regression deterministic
    // without forging an auth token or requiring a specially named test user.
    await signedInValue.evaluate((element, value) => {
      element.textContent = value;
    }, LONG_EMAIL);
    await roleValue.evaluate((element, value) => {
      element.textContent = value;
    }, LONG_ROLE);

    await settleResponsiveLayout(page);
    await expectContained(signedInValue, signedInCell, `${context} signed-in value`);
    await expectContained(roleValue, roleCell, `${context} role value`);

    const [signedInBox, roleBox] = await Promise.all([signedInCell.boundingBox(), roleCell.boundingBox()]);
    expect(signedInBox, `${context} signed-in cell has no layout box`).not.toBeNull();
    expect(roleBox, `${context} role cell has no layout box`).not.toBeNull();
    if (signedInBox && roleBox) {
      expect(boxesOverlap(signedInBox, roleBox), `${context} organizer account cells overlap`).toBe(false);
    }

    await expectNoDocumentHorizontalOverflow(page, context);
    browserErrors.assertNone(context);
  });
}
