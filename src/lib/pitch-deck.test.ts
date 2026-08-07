import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DECK_MAX_BYTES,
  buildDeckStoragePath,
  safeDownloadName,
  isDeckIndicatorEligible,
  canViewDeck,
  deckConfirmSchema,
  isDeckStoragePathForCompany,
  toDeckSummary,
  validateDeckFile,
  validateDeckLink,
} from './pitch-deck';

// ── file validation ──────────────────────────────────────────────────────────

test('accepts pdf, ppt, and pptx files with matching mime types', () => {
  for (const [name, mime] of [
    ['deck.pdf', 'application/pdf'],
    ['deck.ppt', 'application/vnd.ms-powerpoint'],
    ['deck.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  ]) {
    const result = validateDeckFile({ fileName: name, fileSize: 1024, mimeType: mime });
    assert.equal(result.ok, true, `${name} should validate`);
  }
});

test('accepts generic mime types when the extension is allowed', () => {
  assert.equal(validateDeckFile({ fileName: 'deck.pptx', fileSize: 10, mimeType: '' }).ok, true);
  assert.equal(
    validateDeckFile({ fileName: 'deck.ppt', fileSize: 10, mimeType: 'application/octet-stream' }).ok,
    true,
  );
});

test('rejects disallowed extensions and mismatched mime types', () => {
  assert.equal(validateDeckFile({ fileName: 'deck.key', fileSize: 10, mimeType: '' }).ok, false);
  assert.equal(validateDeckFile({ fileName: 'deck', fileSize: 10, mimeType: '' }).ok, false);
  assert.equal(validateDeckFile({ fileName: 'run.exe', fileSize: 10, mimeType: '' }).ok, false);
  assert.equal(
    validateDeckFile({ fileName: 'deck.pdf', fileSize: 10, mimeType: 'text/html' }).ok,
    false,
    'mime contradicting the extension must fail',
  );
});

test('rejects oversized and empty files', () => {
  assert.equal(validateDeckFile({ fileName: 'deck.pdf', fileSize: DECK_MAX_BYTES + 1, mimeType: 'application/pdf' }).ok, false);
  assert.equal(validateDeckFile({ fileName: 'deck.pdf', fileSize: 0, mimeType: 'application/pdf' }).ok, false);
  assert.equal(validateDeckFile({ fileName: 'deck.pdf', fileSize: DECK_MAX_BYTES, mimeType: 'application/pdf' }).ok, true);
});

// ── link validation ──────────────────────────────────────────────────────────

test('accepts https links including Google Drive', () => {
  const result = validateDeckLink('https://drive.google.com/file/d/abc123/view');
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.host, 'drive.google.com');
});

test('rejects non-https, malformed, and credentialed links', () => {
  assert.equal(validateDeckLink('http://example.com/deck.pdf').ok, false);
  assert.equal(validateDeckLink('not a link').ok, false);
  assert.equal(validateDeckLink('ftp://example.com/deck.pdf').ok, false);
  assert.equal(validateDeckLink('https://user:pass@example.com/deck.pdf').ok, false);
  assert.equal(validateDeckLink('').ok, false);
});

// ── storage path binding ─────────────────────────────────────────────────────

test('storage paths bind to the company and follow the expected shape', () => {
  const companyId = '0b5a1e2e-506a-472c-9362-d04680a469b9';
  const path = buildDeckStoragePath(companyId, 'pdf', 'ab12cd');
  assert.equal(isDeckStoragePathForCompany(path, companyId), true);
  assert.equal(isDeckStoragePathForCompany(path, '11111111-1111-4111-8111-111111111111'), false);
  assert.equal(isDeckStoragePathForCompany('../../etc/passwd', companyId), false);
  assert.equal(isDeckStoragePathForCompany(`${companyId}/1-x.exe`, companyId), false);
});

// ── confirm schema ───────────────────────────────────────────────────────────

test('confirm schema accepts exactly one deck shape', () => {
  assert.equal(
    deckConfirmSchema.safeParse({ kind: 'link', url: 'https://drive.google.com/x' }).success,
    true,
  );
  assert.equal(
    deckConfirmSchema.safeParse({
      kind: 'file',
      storagePath: 'abc/1-x.pdf',
      fileName: 'deck.pdf',
      fileSize: 1024,
    }).success,
    true,
  );
  assert.equal(deckConfirmSchema.safeParse({ kind: 'file', url: 'https://x.io' }).success, false);
  assert.equal(deckConfirmSchema.safeParse({ kind: 'link' }).success, false);
});

// ── authz matrix (AC3) ───────────────────────────────────────────────────────

const OWNER = 'owner-uuid';
const ORGANIZER = 'organizer-uuid';
const OTHER = 'other-uuid';

const baseEvent = {
  organizerId: ORGANIZER,
  ownerRole: 'founder',
  ownerStatus: 'active',
};

test('denies anonymous requests', () => {
  assert.equal(canViewDeck({ requesterId: null, deckOwnerId: OWNER, event: { ...baseEvent } }), false);
});

test('allows the owner without any event context', () => {
  assert.equal(canViewDeck({ requesterId: OWNER, deckOwnerId: OWNER }), true);
});

test('allows platform admins without any event context', () => {
  assert.equal(canViewDeck({ requesterId: OTHER, deckOwnerId: OWNER, isPlatformAdmin: true }), true);
});

test('denies unrelated authenticated users with no event context', () => {
  assert.equal(canViewDeck({ requesterId: OTHER, deckOwnerId: OWNER }), false);
});

test('allows the event organizer when the owner is an active founder participant', () => {
  assert.equal(
    canViewDeck({ requesterId: ORGANIZER, deckOwnerId: OWNER, event: { ...baseEvent } }),
    true,
  );
});

test('allows each active team role', () => {
  for (const role of ['organizer', 'admin', 'coach', 'mentor', 'judge']) {
    assert.equal(
      canViewDeck({
        requesterId: OTHER,
        deckOwnerId: OWNER,
        event: { ...baseEvent, requesterRole: role, requesterStatus: 'active' },
      }),
      true,
      `${role} should be allowed`,
    );
  }
});

test('denies a founder-role participant who is not the owner', () => {
  assert.equal(
    canViewDeck({
      requesterId: OTHER,
      deckOwnerId: OWNER,
      event: { ...baseEvent, requesterRole: 'founder', requesterStatus: 'active' },
    }),
    false,
  );
});

test('denies removed team members', () => {
  assert.equal(
    canViewDeck({
      requesterId: OTHER,
      deckOwnerId: OWNER,
      event: { ...baseEvent, requesterRole: 'judge', requesterStatus: 'removed' },
    }),
    false,
  );
});

test('denies team members when the owner is not an active participant of that event', () => {
  assert.equal(
    canViewDeck({
      requesterId: OTHER,
      deckOwnerId: OWNER,
      event: { ...baseEvent, requesterRole: 'coach', requesterStatus: 'active', ownerStatus: 'removed' },
    }),
    false,
  );
  assert.equal(
    canViewDeck({
      requesterId: OTHER,
      deckOwnerId: OWNER,
      event: { ...baseEvent, requesterRole: 'coach', requesterStatus: 'active', ownerRole: 'judge' },
    }),
    false,
    'owner participating as a non-founder team member does not expose their deck',
  );
});

test('organizer of an unrelated event cannot view the deck through it', () => {
  assert.equal(
    canViewDeck({
      requesterId: OTHER,
      deckOwnerId: OWNER,
      event: { organizerId: 'someone-else', requesterRole: null, requesterStatus: null, ownerRole: 'founder', ownerStatus: 'active' },
    }),
    false,
  );
});

// ── dashboard indicator eligibility ──────────────────────────────────────────

test('deck indicators only surface for active founder participants', () => {
  assert.equal(isDeckIndicatorEligible({ role: 'founder', status: 'active' }), true);
  assert.equal(isDeckIndicatorEligible({ role: 'founder', status: 'removed' }), false);
  assert.equal(isDeckIndicatorEligible({ role: 'founder', status: 'invited' }), false);
  for (const role of ['organizer', 'admin', 'coach', 'mentor', 'judge']) {
    assert.equal(isDeckIndicatorEligible({ role, status: 'active' }), false, `${role} must not be indicated`);
  }
});

test('deck indicator eligibility fails closed when fields are missing', () => {
  // A narrowed participant select must never widen exposure.
  assert.equal(isDeckIndicatorEligible({}), false);
  assert.equal(isDeckIndicatorEligible({ role: 'founder' }), false);
  assert.equal(isDeckIndicatorEligible({ status: 'active' }), false);
  assert.equal(isDeckIndicatorEligible({ role: null, status: null }), false);
});

// ── download name sanitization ───────────────────────────────────────────────

test('download names strip URL metacharacters and pin the stored extension', () => {
  assert.equal(safeDownloadName('x&token=abc.pdf', 'pdf'), 'x token abc.pdf');
  assert.equal(safeDownloadName('payroll-2026.pdf.exe', 'pdf'), 'payroll-2026.pdf.pdf');
  assert.equal(safeDownloadName('deck.html', 'pptx'), 'deck.pptx');
  assert.equal(safeDownloadName('Seed Round (v3).pdf', 'pdf'), 'Seed Round (v3).pdf');
  assert.equal(safeDownloadName('', 'pdf'), 'pitch-deck.pdf');
  assert.equal(safeDownloadName('a"; filename="b.exe', 'ppt'), 'a filename b.ppt');
});

// ── summary shaping ──────────────────────────────────────────────────────────

test('summaries expose host for links and name for files, never raw paths', () => {
  const fileSummary = toDeckSummary({ kind: 'file', file_name: 'deck.pdf', updated_at: '2026-08-07' });
  assert.deepEqual(fileSummary, { kind: 'file', fileName: 'deck.pdf', linkHost: null, updatedAt: '2026-08-07' });
  const linkSummary = toDeckSummary({ kind: 'link', link_url: 'https://drive.google.com/file/x', updated_at: null });
  assert.equal(linkSummary.linkHost, 'drive.google.com');
  assert.equal(Object.hasOwn(linkSummary, 'storage_path'), false);
});
