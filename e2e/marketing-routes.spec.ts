import { expect, test } from '@playwright/test';
import { marketingRoutes, prohibitedMarketingClaims } from '../src/lib/marketing-content';
import { captureBrowserErrors, expectNoDocumentHorizontalOverflow, settleResponsiveLayout } from './support/page-health';

const routes = [
  { path: '/marketing-home', canonical: 'https://www.pitchinpublic.io', h1: /Prepare every founder/i, description: marketingRoutes.home.description, current: null },
  { path: '/for-events', canonical: 'https://www.pitchinpublic.io/for-events', h1: /Run pitch preparation/i, description: marketingRoutes.forEvents.description, current: 'For organizers' },
  { path: '/founders', canonical: 'https://www.pitchinpublic.io/founders', h1: /Know what your event expects/i, description: marketingRoutes.founders.description, current: 'For founders' },
  { path: '/about', canonical: 'https://www.pitchinpublic.io/about', h1: /Pitch preparation should start/i, description: marketingRoutes.about.description, current: 'About' },
  { path: '/contact', canonical: 'https://www.pitchinpublic.io/contact', h1: /Tell us how you prepare founders/i, description: marketingRoutes.contact.description, current: 'Contact' },
] as const;

for (const route of routes) {
  test(`${route.path} renders truthful, canonical marketing HTML`, async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 360, height: 800 });
    const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBeLessThan(400);
    await expect(page.getByRole('heading', { level: 1, name: route.h1 })).toBeVisible();
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', route.canonical);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', route.canonical);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', route.description);
    const jsonLdScripts = page.locator('script[type="application/ld+json"]');
    await expect(jsonLdScripts).toHaveCount(1);
    for (const script of await jsonLdScripts.allTextContents()) expect(() => JSON.parse(script)).not.toThrow();
    const renderedText = (await page.locator('body').innerText()).toLowerCase();
    for (const claim of prohibitedMarketingClaims) expect(renderedText).not.toContain(claim.toLowerCase());
    const currentLinks = page.locator('nav a[aria-current="page"]');
    if (route.current) {
      await expect(currentLinks.first()).toHaveText(route.current);
      await expect(currentLinks).toHaveCount(2);
    } else {
      await expect(currentLinks).toHaveCount(0);
    }
    await settleResponsiveLayout(page);
    await expectNoDocumentHorizontalOverflow(page, route.path);
    errors.assertNone(route.path);
  });
}

test('organizer lead dialog traps and restores keyboard focus', async ({ page }) => {
  await page.goto('/marketing-home');
  const trigger = page.getByRole('button', { name: 'Request organizer access' }).first();
  await trigger.focus();
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: /Request organizer/i });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { level: 2, name: /Request organizer/i })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('lead dialog wraps keyboard focus in both directions', async ({ page }) => {
  await page.goto('/marketing-home');
  await page.getByRole('button', { name: 'Request organizer access' }).first().click();
  const dialog = page.getByRole('dialog', { name: /Request organizer/i });
  await expect(dialog.getByRole('heading', { level: 2, name: /Request organizer/i })).toBeFocused();
  const close = dialog.getByRole('button', { name: 'Close lead form' });
  const submit = dialog.getByRole('button', { name: 'Request organizer invite' });

  await close.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(submit).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
});

test('lead dialog validates required fields before sending a request', async ({ page }) => {
  let requestCount = 0;
  await page.route('**/api/leads', async (route) => {
    requestCount += 1;
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ success: true }) });
  });
  await page.goto('/marketing-home');
  await page.getByRole('button', { name: 'Request organizer access' }).first().click();
  await page.getByRole('button', { name: 'Request organizer invite' }).last().click();

  await expect(page.getByLabel('Email')).toBeFocused();
  await expect(page.getByLabel('Email')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('Email')).toHaveAttribute('aria-describedby', /.+/);
  await expect(page.getByLabel('Organization name')).toHaveAttribute('aria-describedby', /.+/);
  await expect(page.getByText('Enter your email address.')).toBeVisible();
  await expect(page.getByText('Enter your organization name.')).toBeVisible();
  expect(requestCount).toBe(0);
});

test('lead dialog preserves entered values and exposes a recoverable API error', async ({ page }) => {
  const requestIds: string[] = [];
  await page.route('**/api/leads', async (route) => {
    requestIds.push((route.request().postDataJSON() as { requestId: string }).requestId);
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, error: 'Please try again shortly.' }),
    });
  });
  await page.goto('/marketing-home');
  await page.getByRole('button', { name: 'Request organizer access' }).first().click();
  await page.getByLabel('Email').fill('organizer@example.com');
  await page.getByLabel('Organization name').fill('Example Accelerator');
  await page.getByLabel('Website or LinkedIn').fill('https://example.com');
  await page.getByRole('button', { name: 'Request organizer invite' }).last().click();

  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Please try again shortly.');
  await expect(page.getByRole('link', { name: /Email hello@pitchinpublic\.io/i })).toHaveAttribute('href', 'mailto:hello@pitchinpublic.io');
  await expect(page.getByLabel('Email')).toHaveValue('organizer@example.com');
  await expect(page.getByLabel('Organization name')).toHaveValue('Example Accelerator');
  await expect(page.getByLabel('Website or LinkedIn')).toHaveValue('https://example.com');
  await page.getByRole('button', { name: 'Request organizer invite' }).last().click();
  await expect.poll(() => requestIds.length).toBe(2);
  expect(requestIds[0]).toBe(requestIds[1]);
  await page.getByLabel('Website or LinkedIn').fill('https://example.org');
  await page.getByRole('button', { name: 'Request organizer invite' }).last().click();
  await expect.poll(() => requestIds.length).toBe(3);
  expect(requestIds[2]).not.toBe(requestIds[1]);
});

test('lead dialog prevents duplicate submissions and focuses the successful completion action', async ({ page }) => {
  let requestCount = 0;
  await page.route('**/api/leads', async (route) => {
    requestCount += 1;
    await new Promise((resolve) => setTimeout(resolve, 100));
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: 'Request received.',
        warning: 'Confirmation email is delayed.',
      }),
    });
  });
  await page.goto('/marketing-home');
  await page.getByRole('button', { name: 'Request organizer access' }).first().click();
  await page.getByLabel('Email').fill('organizer@example.com');
  await page.getByLabel('Organization name').fill('Example Accelerator');
  const submit = page.getByRole('button', { name: 'Request organizer invite' }).last();
  await submit.dblclick();

  await expect(page.getByRole('status')).toHaveText('Request received.');
  await expect(page.getByText('Confirmation email is delayed.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Done' })).toBeFocused();
  expect(requestCount).toBe(1);
});

test('closing a lead dialog aborts an in-flight request without showing stale success', async ({ page }) => {
  await page.route('**/api/leads', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, message: 'Request received.' }),
    });
  });
  await page.goto('/marketing-home');
  const trigger = page.getByRole('button', { name: 'Request organizer access' }).first();
  await trigger.click();
  await page.getByLabel('Email').fill('organizer@example.com');
  await page.getByLabel('Organization name').fill('Example Accelerator');
  await page.getByRole('button', { name: 'Request organizer invite' }).last().click();
  await expect(page.getByRole('button', { name: 'Sending...' })).toBeDisabled();
  await page.keyboard.press('Escape');

  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page.getByText('Request received.')).toHaveCount(0);
});

test('terms remains available but noindex pending legal approval', async ({ page }) => {
  await page.goto('/terms');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Use Pitch in Public constructively/i);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});

test('marketing home remains usable across the locked viewport and reduced-motion matrix', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const viewport of [
    { width: 360, height: 800 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/marketing-home', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText('Choose the take that represents the strongest current pitch')).toBeVisible();
    await settleResponsiveLayout(page);
    await expectNoDocumentHorizontalOverflow(page, `marketing-home ${viewport.width}px reduced motion`);
  }
});

test('the app root remains product-owned and opens sign-in only for the explicit anonymous deep link', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: /Prepare the pitch your next room expects/i })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.goto('/?signin=1');
  await expect(page.getByRole('dialog', { name: /Sign in\. Start pitching\./i })).toBeVisible();
  await expect(page).not.toHaveURL(/signin=1/);
});
