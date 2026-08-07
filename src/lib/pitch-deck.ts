import { z } from 'zod';

export const DECK_MAX_BYTES = 25 * 1024 * 1024;
// Short-lived: the URL is an unauthenticated bearer capability and is re-signed
// on every click, so a small window limits exposure after access is revoked.
export const DECK_SIGNED_URL_SECONDS = 5 * 60;
export const DECK_BUCKET = 'pitch-decks';

export const DECK_EXTENSIONS: Record<string, string[]> = {
  pdf: ['application/pdf'],
  ppt: ['application/vnd.ms-powerpoint'],
  pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
};

// Some browsers/OSes report generic or empty MIME types for Office files, so
// the extension is authoritative and the MIME type only has to be consistent.
const GENERIC_MIME_TYPES = new Set(['', 'application/octet-stream']);

export type DeckFileValidation =
  | { ok: true; extension: string }
  | { ok: false; error: string };

export function validateDeckFile(input: {
  fileName?: unknown;
  fileSize?: unknown;
  mimeType?: unknown;
}): DeckFileValidation {
  const fileName = typeof input.fileName === 'string' ? input.fileName.trim() : '';
  const fileSize = typeof input.fileSize === 'number' ? input.fileSize : Number.NaN;
  const mimeType = typeof input.mimeType === 'string' ? input.mimeType.trim().toLowerCase() : '';

  if (!fileName || fileName.length > 200) {
    return { ok: false, error: 'Use a file name under 200 characters.' };
  }

  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  const allowedMimes = DECK_EXTENSIONS[extension];
  if (!allowedMimes || fileName.split('.').length < 2) {
    return { ok: false, error: 'Upload a PDF, PPT, or PPTX file.' };
  }

  if (!GENERIC_MIME_TYPES.has(mimeType) && !allowedMimes.includes(mimeType)) {
    return { ok: false, error: 'The file type does not match its extension.' };
  }

  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    return { ok: false, error: 'The selected file is empty.' };
  }

  if (fileSize > DECK_MAX_BYTES) {
    return { ok: false, error: 'Keep the deck under 25MB.' };
  }

  return { ok: true, extension };
}

export type DeckLinkValidation =
  | { ok: true; url: string; host: string }
  | { ok: false; error: string };

/**
 * Links are stored and displayed, never fetched server-side, so validation is
 * about shape and honesty (https, no embedded credentials), not reachability.
 */
export function validateDeckLink(raw: unknown): DeckLinkValidation {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value || value.length > 2048) {
    return { ok: false, error: 'Paste a link under 2048 characters.' };
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, error: 'Paste a full link, like https://drive.google.com/...' };
  }

  if (url.protocol !== 'https:') {
    return { ok: false, error: 'Deck links must use https.' };
  }

  if (url.username || url.password) {
    return { ok: false, error: 'Remove the credentials from the link.' };
  }

  return { ok: true, url: url.toString(), host: url.hostname };
}

const STORAGE_PATH_PATTERN = /^[0-9a-f-]{36}\/\d+-[a-z0-9]+\.(pdf|ppt|pptx)$/;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Guards path params that hit uuid columns, so fuzzed values 404 instead of 500. */
export function isUuidLike(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

export function buildDeckStoragePath(companyId: string, extension: string, nonce: string) {
  return `${companyId}/${Date.now()}-${nonce}.${extension}`;
}

export function isDeckStoragePathForCompany(path: unknown, companyId: string) {
  return (
    typeof path === 'string' &&
    STORAGE_PATH_PATTERN.test(path) &&
    path.startsWith(`${companyId}/`)
  );
}

export const deckConfirmSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('file'),
      storagePath: z.string().min(3).max(300),
      fileName: z.string().trim().min(1).max(200),
      fileSize: z.number().int().positive().max(DECK_MAX_BYTES),
    })
    .strict(),
  z
    .object({
      kind: z.literal('link'),
      url: z.string().trim().min(1).max(2048),
    })
    .strict(),
]);

export type DeckAccessContext = {
  requesterId: string | null;
  deckOwnerId: string;
  isPlatformAdmin?: boolean;
  event?: {
    organizerId: string;
    requesterRole?: string | null;
    requesterStatus?: string | null;
    ownerRole?: string | null;
    ownerStatus?: string | null;
  } | null;
};

const DECK_TEAM_ROLES = new Set(['organizer', 'admin', 'coach', 'mentor', 'judge']);

/**
 * Deny-by-default deck visibility. A requester may view a founder's deck when
 * they are the owner, a platform admin, or — through a specific event — an
 * active team member of an event where the owner is an active founder
 * participant. Removed participants and removed team members are denied.
 */
export function canViewDeck(context: DeckAccessContext): boolean {
  if (!context.requesterId) return false;
  if (context.requesterId === context.deckOwnerId) return true;
  if (context.isPlatformAdmin) return true;

  const event = context.event;
  if (!event) return false;

  const ownerActiveFounder =
    event.ownerStatus === 'active' && (event.ownerRole || 'founder') === 'founder';
  if (!ownerActiveFounder) return false;

  if (context.requesterId === event.organizerId) return true;

  return (
    event.requesterStatus === 'active' &&
    DECK_TEAM_ROLES.has(event.requesterRole || '')
  );
}

/**
 * Sanitize a display filename for the signed URL's download parameter:
 * storage-js interpolates it into the query string without encoding, so strip
 * URL metacharacters and pin the extension to the stored object's.
 */
export function safeDownloadName(fileName: string | null | undefined, storedExtension: string) {
  const base = (fileName || '')
    .replace(/\.[^.]*$/, '')
    .replace(/[^\w .()-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return `${base || 'pitch-deck'}.${storedExtension}`;
}

/**
 * Dashboard-indicator eligibility, mirroring canViewDeck's owner rule: only an
 * ACTIVE founder participant's deck may be indicated. Requires status and role
 * to be present — a narrowed participant select must fail closed, not open.
 */
export function isDeckIndicatorEligible(row: { role?: string | null; status?: string | null }) {
  return row.status === 'active' && row.role === 'founder';
}

export type DeckSummary = {
  kind: 'file' | 'link';
  fileName: string | null;
  linkHost: string | null;
  updatedAt: string | null;
};

export function toDeckSummary(row: {
  kind: string;
  file_name?: string | null;
  link_url?: string | null;
  updated_at?: string | null;
}): DeckSummary {
  let linkHost: string | null = null;
  if (row.kind === 'link' && row.link_url) {
    try {
      linkHost = new URL(row.link_url).hostname;
    } catch {
      linkHost = null;
    }
  }
  return {
    kind: row.kind === 'link' ? 'link' : 'file',
    fileName: row.file_name || null,
    linkHost,
    updatedAt: row.updated_at || null,
  };
}
