import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { feedbackHistoryRequestUrl, givenFeedbackNotes } from './ProfileFeedbackHistory.helpers';

const source = readFileSync(new URL('./ProfileFeedbackHistory.tsx', import.meta.url), 'utf8');
const profileSource = readFileSync(new URL('../app/profile/[userId]/page.tsx', import.meta.url), 'utf8');

test('history requests preserve both stable cursor fields', () => {
  const url = feedbackHistoryRequestUrl({
    beforeCreatedAt: '2026-08-29T01:00:00.000Z',
    beforeId: '00000000-0000-4000-8000-000000000001',
  });
  assert.match(url, /beforeCreatedAt=2026-08-29T01%3A00%3A00\.000Z/);
  assert.match(url, /beforeId=00000000-0000-4000-8000-000000000001/);
});

test('given feedback falls back from notes to a structured observation', () => {
  const item = {
    feedbackId: 'feedback-id',
    pitch: { available: false, id: null, publicId: null, hook: null, startupName: null },
    type: 'toast' as const,
    content: {},
    reviewerRole: null,
    structured: { criterionKey: null, observation: 'Clear customer problem.', nextStep: null },
    createdAt: '2026-08-29T01:00:00.000Z',
  };
  assert.equal(givenFeedbackNotes(item), 'Clear customer problem.');
});

test('own-profile history uses accessible tabs and a non-identifying unavailable label', () => {
  assert.match(source, /role="tablist"/);
  assert.match(source, /aria-selected=/);
  assert.match(source, /role="tabpanel"/);
  assert.match(source, />Pitch unavailable</);
  assert.doesNotMatch(source, /Must not leak/);
});

test('Given stays private to the profile owner and tab choices are stored in navigation history', () => {
  assert.match(profileSource, /showGiven=\{isOwnProfile\}/);
  assert.match(profileSource, /router\.push\(`\$\{pathname\}\?\$\{query\.toString\(\)\}`/);
  assert.match(profileSource, /pitchData\.feedbackState === 'unavailable'/);
  assert.match(profileSource, /receivedFeedbackState === 'available' \? allFeedback\.length : '—'/);
});
