import assert from 'node:assert/strict';
import test from 'node:test';
import { canManageEvent, parseEventUpdate } from './_server';

const current = {
  event_date: '2026-09-20',
  submission_deadline: '2026-09-18T00:00:00.000Z',
};

test('allows only the owner or an active organizer/admin to edit', () => {
  assert.equal(canManageEvent({ userId: 'owner', organizerId: 'owner' }), true);
  assert.equal(
    canManageEvent({ userId: 'manager', organizerId: 'owner', participantRole: 'organizer', participantStatus: 'active' }),
    true
  );
  assert.equal(
    canManageEvent({ userId: 'admin', organizerId: 'owner', participantRole: 'admin', participantStatus: 'active' }),
    true
  );
  assert.equal(
    canManageEvent({ userId: 'inactive', organizerId: 'owner', participantRole: 'admin', participantStatus: 'removed' }),
    false
  );

  for (const role of ['coach', 'mentor', 'judge', 'founder']) {
    assert.equal(
      canManageEvent({ userId: role, organizerId: 'owner', participantRole: role, participantStatus: 'active' }),
      false
    );
  }
});

test('normalizes a valid full event update including six-minute pitches', () => {
  const result = parseEventUpdate(
    {
      name: 'Demo Day Finals',
      description: '',
      eventDate: '2026-10-02',
      submissionDeadline: '2026-10-01',
      pitchLengthSeconds: 360,
      focuses: ['Clarity and ask', 'Storytelling', 'clarity and ask'],
      visibility: 'unlisted',
      accessCodeAction: 'replace',
      accessCode: 'FINAL2026',
      reviewTarget: 4,
      pitchHourStartsAt: '2026-10-01T20:00:00.000Z',
      pitchHourEndsAt: '2026-10-01T21:00:00.000Z',
    },
    current,
    new Date('2026-08-01T12:00:00.000Z')
  );

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.deepEqual(result.update, {
    name: 'Demo Day Finals',
    description: null,
    event_date: '2026-10-02',
    submission_deadline: '2026-10-01',
    pitch_length_seconds: 360,
    focus: 'Clarity and ask · Storytelling',
    visibility: 'unlisted',
    access_code: 'FINAL2026',
    review_target: 4,
    pitch_hour_starts_at: '2026-10-01T20:00:00.000Z',
    pitch_hour_ends_at: '2026-10-01T21:00:00.000Z',
    updated_at: '2026-08-01T12:00:00.000Z',
  });
});

test('keeps, replaces, and removes access codes only through explicit intent', () => {
  const keep = parseEventUpdate({ name: 'Keep Existing Code', accessCodeAction: 'keep' }, current);
  assert.equal(keep.success, true);
  if (keep.success) assert.equal('access_code' in keep.update, false);

  const remove = parseEventUpdate({ accessCodeAction: 'remove' }, current);
  assert.equal(remove.success, true);
  if (remove.success) assert.equal(remove.update.access_code, null);

  const ambiguous = parseEventUpdate({ accessCode: 'NEWCODE' }, current);
  assert.equal(ambiguous.success, false);
});

test('rejects a submission deadline after pitch day', () => {
  const result = parseEventUpdate(
    { eventDate: '2026-09-20', submissionDeadline: '2026-09-21' },
    current
  );
  assert.equal(result.success, false);
  if (!result.success) {
    assert.deepEqual(result.issues.submissionDeadline, [
      'Submission deadline must be on or before pitch day.',
    ]);
  }
});

test('validates pitch-hour pairs and ordering', () => {
  const missingEnd = parseEventUpdate(
    { pitchHourStartsAt: '2026-09-19T18:00:00.000Z' },
    current
  );
  assert.equal(missingEnd.success, false);

  const invalidOrder = parseEventUpdate(
    {
      pitchHourStartsAt: '2026-09-19T19:00:00.000Z',
      pitchHourEndsAt: '2026-09-19T18:00:00.000Z',
    },
    current
  );
  assert.equal(invalidOrder.success, false);
});

test('rejects pitch lengths beyond six minutes and oversized focus summaries', () => {
  const tooLong = parseEventUpdate({ pitchLengthSeconds: 361 }, current);
  assert.equal(tooLong.success, false);

  const oversizedFocus = parseEventUpdate(
    { focuses: Array.from({ length: 5 }, (_, index) => `${index}-${'x'.repeat(38)}`) },
    current
  );
  assert.equal(oversizedFocus.success, false);
});

test('rejects unknown or ownership fields', () => {
  const result = parseEventUpdate(
    { name: 'Valid Name', organizer_id: 'attacker', slug: 'changed', status: 'archived' },
    current
  );
  assert.equal(result.success, false);
});
