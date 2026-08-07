import { INVITE_EMAIL_PATTERN, MAX_BULK_FOUNDER_INVITES } from './event-dashboard';

/**
 * Separators accepted between typed or pasted addresses. Tabs and newlines make
 * a column copied from Excel/Google Sheets split into individual entries.
 */
export const EMAIL_CHIP_SEPARATORS = /[\s,;]+/;

export function containsEmailSeparator(text: string) {
  return /[\s,;]/.test(text);
}

export function splitEmailTokens(text: string): string[] {
  return text
    .split(EMAIL_CHIP_SEPARATORS)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
}

export function isValidInviteEmail(email: string) {
  return INVITE_EMAIL_PATTERN.test(email);
}

export function mergeEmailChips(
  existing: readonly string[],
  incoming: readonly string[],
  limit = MAX_BULK_FOUNDER_INVITES
) {
  const chips = [...existing];
  const seen = new Set(existing);
  let overflow = 0;

  for (const raw of incoming) {
    const email = raw.trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    if (chips.length >= limit) {
      overflow += 1;
      continue;
    }
    seen.add(email);
    chips.push(email);
  }

  return { chips, overflow };
}

/**
 * Pulls address-shaped cells out of CSV/TSV text. Non-address columns (names,
 * companies) are skipped so an exported contact sheet works without cleanup.
 * Handles quoted cells, `Name <email>` display forms, and mailto: prefixes.
 */
export function extractEmailsFromCsvText(text: string): string[] {
  const found: string[] = [];

  for (const line of text.split(/\r?\n/)) {
    for (const rawCell of line.split(/[,;\t]/)) {
      let cell = rawCell.trim().replace(/^["']+|["']+$/g, '').trim();
      if (!cell || !cell.includes('@')) continue;

      const displayForm = cell.match(/<([^<>\s]+@[^<>\s]+)>/);
      if (displayForm) cell = displayForm[1];
      cell = cell.replace(/^mailto:/i, '');

      found.push(cell.toLowerCase());
    }
  }

  return found;
}
