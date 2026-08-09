import assert from 'node:assert/strict';
import test from 'node:test';
import { deadlineCountdown, founderEventStatusChip, pickRibbon } from './event-orientation';

// Local-time fixture: production compares a local `now` against locally-
// anchored deadlines, so the tests must too (a UTC instant flips calendar
// days on UTC+12 runners).
const NOW = new Date(2026, 7, 9, 12, 0, 0);

test('countdown covers today, tomorrow, future, past, and absent deadlines', () => {
  assert.equal(deadlineCountdown('2026-08-09', NOW), 'due today');
  assert.equal(deadlineCountdown('2026-08-10', NOW), 'due tomorrow');
  assert.equal(deadlineCountdown('2026-08-27', NOW), 'due in 18d');
  assert.equal(deadlineCountdown('2026-08-01', NOW), 'past due');
  assert.equal(deadlineCountdown(null, NOW), null);
  assert.equal(deadlineCountdown('not-a-date', NOW), null);
});

test('founder chips reflect submission state and urgency', () => {
  assert.deepEqual(
    founderEventStatusChip({ role: 'founder', mySubmission: true }, NOW),
    { label: 'Submitted', tone: 'ready' },
  );
  assert.deepEqual(
    founderEventStatusChip({ role: 'founder', submissionDeadline: '2026-08-27' }, NOW),
    { label: 'Not submitted · due in 18d', tone: 'muted' },
  );
  assert.deepEqual(
    founderEventStatusChip({ role: 'founder', submissionDeadline: '2026-08-11' }, NOW),
    { label: 'Not submitted · due in 2d', tone: 'warn' },
  );
  assert.deepEqual(
    founderEventStatusChip({ role: 'founder', submissionDeadline: '2026-08-01' }, NOW),
    { label: 'Not submitted · past due', tone: 'warn' },
  );
  assert.deepEqual(
    founderEventStatusChip({ role: 'founder' }, NOW),
    { label: 'Not submitted', tone: 'muted' },
  );
});

test('non-founder roles get no submission chip', () => {
  for (const role of ['organizer', 'admin', 'coach', 'mentor', 'judge']) {
    assert.equal(founderEventStatusChip({ role, mySubmission: false }, NOW), null);
  }
});

test('a pending invitation wins the ribbon', () => {
  const model = pickRibbon(
    [{ slug: 'e1', name: 'Event One', pitch_event_participants: [{ role: 'founder', status: 'active' }] }],
    [{ event: { slug: 'e2', name: 'Invited Event' }, invite_url: '/events/e2?invite=abc' }],
    NOW,
  );
  assert.deepEqual(model, { kind: 'invitation', name: 'Invited Event', href: '/events/e2?invite=abc' });
});

test('nearest-deadline active founder event wins otherwise', () => {
  const model = pickRibbon(
    [
      { slug: 'far', name: 'Far', submission_deadline: '2026-09-20', mySubmission: false, pitch_event_participants: [{ role: 'founder', status: 'active' }] },
      { slug: 'near', name: 'Near', submission_deadline: '2026-08-27', mySubmission: true, pitch_event_participants: [{ role: 'founder', status: 'active' }] },
      { slug: 'team', name: 'Team event', submission_deadline: '2026-08-10', pitch_event_participants: [{ role: 'judge', status: 'active' }] },
      { slug: 'removed', name: 'Removed', submission_deadline: '2026-08-10', pitch_event_participants: [{ role: 'founder', status: 'removed' }] },
    ],
    [],
    NOW,
  );
  assert.equal(model?.kind, 'event');
  if (model?.kind === 'event') {
    assert.equal(model.name, 'Near');
    assert.equal(model.countdown, 'due in 18d');
    assert.equal(model.submitted, true);
    assert.equal(model.href, '/events/near');
  }
});

test('no events and no invitations means no ribbon', () => {
  assert.equal(pickRibbon([], [], NOW), null);
  assert.equal(pickRibbon(null, undefined, NOW), null);
});

test('unknown submission state renders no chip', () => {
  assert.equal(founderEventStatusChip({ role: 'founder', mySubmission: null, submissionDeadline: '2026-08-27' }, NOW), null);
});
