import { expect, test } from '@playwright/test';

// Regression: ISSUE-001 — install prompt overlapped the sign-in modal and keyboard users could not dismiss it safely.
// Found by /qa on 2026-08-04
// Report: .gstack/qa-reports/qa-report-localhost-2026-08-04.md
test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});

test('sign-in modal owns focus and temporarily hides the install prompt', async ({ page }) => {
  await page.goto('/');

  const trigger = page.getByRole('button', { name: 'Sign in' }).first();
  await trigger.focus();
  await page.keyboard.press('Enter');

  const dialog = page.getByRole('dialog', { name: /sign in/i });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close sign in' })).toBeFocused();
  await expect(page.getByText('Add Pitch in Public to your home screen')).toBeHidden();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('hidden');

  await page.keyboard.press('Escape');

  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
});

test('sign-in modal traps focus in both directions and closes from its backdrop', async ({ page }) => {
  await page.goto('/');

  const trigger = page.getByRole('button', { name: 'Sign in' }).first();
  await trigger.click();

  const dialog = page.getByRole('dialog', { name: /sign in/i });
  const closeButton = page.getByRole('button', { name: 'Close sign in' });
  const emailCodeButton = page.getByRole('button', { name: 'Email me a code' });
  await expect(dialog).toBeVisible();
  await expect(closeButton).toBeFocused();

  await page.keyboard.press('Shift+Tab');
  await expect(emailCodeButton).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(closeButton).toBeFocused();

  await page.locator('.fixed.inset-0.z-\\[100\\]').click({ position: { x: 2, y: 2 } });
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});
