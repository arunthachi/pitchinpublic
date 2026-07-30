import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getEventDashboardUrl,
  getEventReminderMilestone,
  getEventRoomUrl,
  getLocalDateKey,
  getLocalWeekday,
  getLocalWeekKey,
  shouldSendDailyNudge,
} from './nudges';

test('sends within the selected local-time window', () => {
  const now = new Date('2026-07-19T13:35:00.000Z'); // 9:35 AM in New York

  assert.equal(
    shouldSendDailyNudge({ now, timeZone: 'America/New_York', dailyNudgeTime: '09:30:00' }),
    true
  );
});

test('does not send before the selected local time', () => {
  const now = new Date('2026-07-19T13:05:00.000Z'); // 9:05 AM in New York

  assert.equal(
    shouldSendDailyNudge({ now, timeZone: 'America/New_York', dailyNudgeTime: '09:30:00' }),
    false
  );
});

test('allows a delayed execution within the two-hour catch-up window', () => {
  const now = new Date('2026-07-19T14:59:00.000Z'); // 10:59 AM in New York

  assert.equal(
    shouldSendDailyNudge({ now, timeZone: 'America/New_York', dailyNudgeTime: '09:00:00' }),
    true
  );
});

test('does not send after the catch-up window closes', () => {
  const now = new Date('2026-07-19T15:00:00.000Z'); // 11:00 AM in New York

  assert.equal(
    shouldSendDailyNudge({ now, timeZone: 'America/New_York', dailyNudgeTime: '09:00:00' }),
    false
  );
});

test('evaluates the same instant independently for each user timezone', () => {
  const now = new Date('2026-07-19T13:05:00.000Z');

  assert.equal(
    shouldSendDailyNudge({ now, timeZone: 'America/New_York', dailyNudgeTime: '09:00:00' }),
    true
  );
  assert.equal(
    shouldSendDailyNudge({ now, timeZone: 'America/Los_Angeles', dailyNudgeTime: '09:00:00' }),
    false
  );
});

test('handles the daylight-saving spring-forward gap', () => {
  const now = new Date('2026-03-08T07:05:00.000Z'); // 3:05 AM after New York skips 2 AM

  assert.equal(
    shouldSendDailyNudge({ now, timeZone: 'America/New_York', dailyNudgeTime: '02:30:00' }),
    true
  );
});

test('normalizes Intl midnight hour 24 so late-evening nudges do not send', () => {
  const now = new Date('2026-07-19T04:05:00.000Z'); // 12:05 AM in New York

  assert.equal(
    shouldSendDailyNudge({ now, timeZone: 'America/New_York', dailyNudgeTime: '23:00:00' }),
    false
  );
});

test('falls back safely for invalid stored preferences', () => {
  const now = new Date('2026-07-19T13:05:00.000Z');

  assert.equal(
    shouldSendDailyNudge({ now, timeZone: 'not-a-timezone', dailyNudgeTime: 'not-a-time' }),
    true
  );
  assert.equal(getLocalDateKey(now, 'not-a-timezone'), '2026-07-19');
});

test('selects the nearest event reminder milestone without sending after the deadline', () => {
  const now = new Date('2026-07-20T12:00:00.000Z');

  assert.equal(
    getEventReminderMilestone({
      now,
      submissionDeadline: '2026-07-27T12:00:00.000Z',
    }),
    '7d'
  );
  assert.equal(
    getEventReminderMilestone({
      now,
      submissionDeadline: '2026-07-23T12:00:00.000Z',
    }),
    '72h'
  );
  assert.equal(
    getEventReminderMilestone({
      now,
      submissionDeadline: '2026-07-21T12:00:00.000Z',
    }),
    '24h'
  );
  assert.equal(
    getEventReminderMilestone({
      now,
      submissionDeadline: '2026-07-20T11:59:59.000Z',
    }),
    null
  );
});

test('calculates weekly digest dates in the recipient timezone', () => {
  const now = new Date('2026-07-28T03:30:00.000Z');

  assert.equal(getLocalWeekday(now, 'America/New_York'), 'Mon');
  assert.equal(getLocalWeekKey(now, 'America/New_York'), '2026-07-27');
  assert.equal(getLocalWeekday(now, 'Asia/Tokyo'), 'Tue');
  assert.equal(getLocalWeekKey(now, 'Asia/Tokyo'), '2026-07-27');
});

test('notification links use public event slugs instead of database identifiers', () => {
  const previousAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  process.env.NEXT_PUBLIC_APP_URL = 'https://staging-pip.pitchinpublic.io/';

  try {
    assert.equal(
      getEventRoomUrl('founder-sprint-july'),
      'https://staging-pip.pitchinpublic.io/events/founder-sprint-july'
    );
    assert.equal(
      getEventDashboardUrl('founder-sprint-july'),
      'https://staging-pip.pitchinpublic.io/events/founder-sprint-july/dashboard'
    );
    assert.equal(
      getEventDashboardUrl('room / private'),
      'https://staging-pip.pitchinpublic.io/events/room%20%2F%20private/dashboard'
    );
  } finally {
    if (previousAppUrl === undefined) {
      delete process.env.NEXT_PUBLIC_APP_URL;
    } else {
      process.env.NEXT_PUBLIC_APP_URL = previousAppUrl;
    }
  }
});
