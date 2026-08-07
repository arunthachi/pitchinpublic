import { INVITE_EMAIL_PATTERN, MAX_BULK_FOUNDER_INVITES } from './event-dashboard';

/**
 * Splitting model: hard separators (comma, semicolon, tab, newline) delimit
 * entries first, so `Name <email>` display forms copied from a mail client
 * stay intact long enough to extract the address. Space splits only within a
 * segment that has no display form. Tabs and newlines make a column copied
 * from Excel/Google Sheets split into individual entries.
 */
const SEGMENT_SEPARATORS = /[,;\t\r\n]+/;
const DISPLAY_FORM_EMAILS = /<([^<>\s]+@[^<>\s]+)>/g;

export function containsEmailSeparator(text: string) {
  return /[\s,;]/.test(text);
}

function normalizeToken(raw: string) {
  return raw
    .trim()
    .replace(/^["']+|["']+$/g, '')
    .replace(/^mailto:/i, '')
    .trim()
    .toLowerCase();
}

export function splitEmailTokens(text: string): string[] {
  const results: string[] = [];

  for (const segment of text.split(SEGMENT_SEPARATORS)) {
    // Unwrap "Jordan Lee <jordan@startup.com>" in place so bare addresses
    // sharing the segment keep their position and are never dropped.
    const expanded = segment.replace(DISPLAY_FORM_EMAILS, (_, email: string) => ` ${email} `);
    const hadDisplayForm = expanded !== segment;

    for (const raw of expanded.split(/\s+/)) {
      const token = normalizeToken(raw);
      if (!token) continue;
      // Only a display-form segment may carry bare name words; drop those
      // while keeping anything address-like (containing @), so a malformed
      // address still surfaces as a flagged chip instead of vanishing.
      // Plain segments keep all tokens so typed mistakes stay flaggable.
      if (hadDisplayForm && !token.includes('@')) continue;
      results.push(token);
    }
  }

  return results;
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
  const seen = new Set(existing.map((email) => email.trim().toLowerCase()));
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
 * Pulls addresses out of CSV/TSV/plain-text exports. Only address-shaped
 * tokens survive, so name, company, and social-handle columns (`@handle`)
 * never become chips and a contact export works without cleanup — at the
 * cost of skipping malformed addresses, which the UI surfaces through the
 * added-count notice rather than silently.
 */
export function extractEmailsFromCsvText(text: string): string[] {
  return splitEmailTokens(text).filter((token) => INVITE_EMAIL_PATTERN.test(token));
}
