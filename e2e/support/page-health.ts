import { expect, type ConsoleMessage, type Page } from '@playwright/test';

type CapturedBrowserErrors = {
  consoleErrors: string[];
  pageErrors: string[];
};

// Keep this list deliberately narrow. Add an exclusion only after proving the
// message is an intentional browser/platform condition rather than an app bug.
const INTENTIONAL_CONSOLE_ERROR_PATTERNS: RegExp[] = [];

function formatConsoleError(message: ConsoleMessage) {
  const location = message.location();
  const source = location.url ? ` (${location.url}:${location.lineNumber}:${location.columnNumber})` : '';
  return `${message.text()}${source}`;
}

export function captureBrowserErrors(page: Page) {
  const captured: CapturedBrowserErrors = {
    consoleErrors: [],
    pageErrors: [],
  };

  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    if (INTENTIONAL_CONSOLE_ERROR_PATTERNS.some((pattern) => pattern.test(message.text()))) return;
    captured.consoleErrors.push(formatConsoleError(message));
  });

  page.on('pageerror', (error) => {
    captured.pageErrors.push(error.stack || error.message);
  });

  return {
    assertNone(context: string) {
      expect(captured.pageErrors, `${context} emitted uncaught page errors`).toEqual([]);
      expect(captured.consoleErrors, `${context} emitted console errors`).toEqual([]);
    },
  };
}

export async function settleResponsiveLayout(page: Page) {
  await page.evaluate(async () => {
    await document.fonts?.ready;
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
}

export async function expectNoDocumentHorizontalOverflow(page: Page, context: string) {
  const dimensions = await page.evaluate(() => ({
    documentClientWidth: document.documentElement.clientWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    bodyClientWidth: document.body.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));

  expect(
    dimensions.documentScrollWidth,
    `${context} document overflowed horizontally: ${JSON.stringify(dimensions)}`
  ).toBeLessThanOrEqual(dimensions.documentClientWidth + 1);
  expect(
    dimensions.bodyScrollWidth,
    `${context} body overflowed horizontally: ${JSON.stringify(dimensions)}`
  ).toBeLessThanOrEqual(dimensions.bodyClientWidth + 1);
}
