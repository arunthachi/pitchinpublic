import assert from 'node:assert/strict';
import test from 'node:test';
import { getLocalDateKey, shouldSendDailyNudge } from './nudges';

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
