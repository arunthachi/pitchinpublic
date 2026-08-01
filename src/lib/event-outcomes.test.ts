import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEventOutcomeReport, eventOutcomeCsv, sanitizeOutcomeFeedback, type EventOutcomeInput } from './event-outcomes';

const uuid = {
  event: '00000000-0000-4000-8000-000000000001',
  founderA: '00000000-0000-4000-8000-000000000002',
  founderB: '00000000-0000-4000-8000-000000000003',
  pitchA1: '00000000-0000-4000-8000-000000000004',
  pitchA2: '00000000-0000-4000-8000-000000000005',
  pitchB1: '00000000-0000-4000-8000-000000000006',
};

function fixture(): EventOutcomeInput {
  return {
    event: {
      name: 'Demo Day',
      slug: 'demo-day',
      eventDate: '2026-08-15',
      submissionDeadline: '2026-08-14T20:00:00.000Z',
    },
    generatedAt: '2026-08-16T12:00:00.000Z',
    invitations: [
      { email: 'a@example.com', status: 'accepted', acceptedUserId: uuid.founderA },
      { email: 'b@example.com', status: 'accepted', acceptedUserId: uuid.founderB },
      { email: 'pending@example.com', status: 'pending' },
      { email: 'old@example.com', status: 'revoked' },
    ],
    participants: [
      { userId: uuid.founderA, name: 'Avery Founder', email: 'a@example.com', status: 'active', joinedAt: '2026-08-01T12:00:00.000Z' },
      { userId: uuid.founderB, name: 'Blair Founder', email: 'b@example.com', status: 'active', joinedAt: '2026-08-02T12:00:00.000Z' },
    ],
    pitches: [
      {
        id: uuid.pitchA1,
        userId: uuid.founderA,
        status: 'published',
        deletedAt: null,
        createdAt: '2026-08-03T12:00:00.000Z',
        isBestTake: false,
        feedback: [
          { type: 'roast', content: JSON.stringify({ signals: ['Clarity'], readiness: 3, notes: 'private alpha note' }), createdAt: '2026-08-03T12:30:00.000Z' },
        ],
      },
      {
        id: uuid.pitchA2,
        userId: uuid.founderA,
        status: 'published',
        deletedAt: null,
        createdAt: '2026-08-05T12:00:00.000Z',
        isBestTake: true,
        feedback: [
          { type: 'roast', content: JSON.stringify({ signals: ['Clarity', 'Ask'], readiness: 4, notes: 'private beta note' }), createdAt: '2026-08-05T12:15:00.000Z' },
        ],
      },
      {
        id: uuid.pitchB1,
        userId: uuid.founderB,
        status: 'published',
        deletedAt: null,
        createdAt: '2026-08-04T12:00:00.000Z',
        isBestTake: false,
        feedback: [
          { type: 'roast', content: JSON.stringify({ signal: 'Clarity', readiness: 2 }), createdAt: '2026-08-04T13:00:00.000Z' },
        ],
      },
    ],
    submissions: [
      { userId: uuid.founderA, pitchId: uuid.pitchA2, status: 'submitted', submittedAt: '2026-08-10T12:00:00.000Z' },
    ],
  };
}

test('matches seeded source-of-truth metrics', () => {
  const report = buildEventOutcomeReport(fixture());

  assert.deepEqual(report.metrics, {
    invited: 3,
    joined: 2,
    firstTake: 2,
    improvedTake: 1,
    feedbackCoverage: { count: 2, total: 2, percent: 100 },
    averageTimeToFirstFeedbackMinutes: 45,
    medianTimeToFirstFeedbackMinutes: 45,
    timeToFirstFeedbackSampleSize: 2,
    bestTake: 1,
    finalSubmission: 1,
    pitchReady: 1,
  });
  assert.deepEqual(report.commonImprovementSignals[0], {
    label: 'Clarity',
    founderCount: 2,
    occurrences: 3,
  });
  assert.equal(report.founders.length, 3);
});

test('excludes pitches outside the membership window and includes the submitted pitch', () => {
  const input = fixture();
  input.pitches.push(
    { ...input.pitches[0], id: 'pre-join', createdAt: '2026-07-01T12:00:00.000Z', feedback: [] },
    { ...input.pitches[0], id: 'post-cutoff', createdAt: '2026-08-20T12:00:00.000Z', feedback: [] },
    { ...input.pitches[0], id: 'draft', status: 'draft', createdAt: '2026-08-06T12:00:00.000Z', feedback: [] },
    { ...input.pitches[0], id: 'deleted', deletedAt: '2026-08-07T12:00:00.000Z', feedback: [] },
  );

  const report = buildEventOutcomeReport(input);
  assert.equal(report.founders.find((founder) => founder.email === 'a@example.com')?.eligibleTakeCount, 2);
});

test('excludes feedback and submissions recorded after the report cutoff', () => {
  const input = fixture();
  input.pitches[2].feedback = [{
    type: 'roast',
    content: JSON.stringify({ signals: ['Late signal'], readiness: 4 }),
    createdAt: '2026-08-20T13:00:00.000Z',
  }];
  input.submissions.push({
    userId: uuid.founderB,
    pitchId: uuid.pitchB1,
    status: 'submitted',
    submittedAt: '2026-08-20T12:00:00.000Z',
  });

  const report = buildEventOutcomeReport(input);
  const founder = report.founders.find((row) => row.email === 'b@example.com');

  assert.equal(founder?.feedbackCovered, false);
  assert.equal(founder?.finalSubmissionCompleted, false);
  assert.equal(founder?.pitchReady, false);
  assert.equal(report.commonImprovementSignals.some((signal) => signal.label === 'Late signal'), false);
});

test('returns explicit empty timing and coverage states', () => {
  const input = fixture();
  input.participants = [];
  input.pitches = [];
  input.submissions = [];
  const report = buildEventOutcomeReport(input);

  assert.deepEqual(report.metrics.feedbackCoverage, { count: 0, total: 0, percent: null });
  assert.equal(report.metrics.averageTimeToFirstFeedbackMinutes, null);
  assert.equal(report.metrics.medianTimeToFirstFeedbackMinutes, null);
  assert.equal(report.event.reportingStart, null);
});

test('never materializes notes or malformed raw feedback', () => {
  assert.deepEqual(
    sanitizeOutcomeFeedback({ type: 'roast', content: 'private malformed note', createdAt: '2026-08-01T00:00:00.000Z' }),
    { type: 'roast', signals: [], readiness: null, createdAt: '2026-08-01T00:00:00.000Z' }
  );

  const input = fixture();
  input.pitches[0].feedback.push({ type: 'roast', content: 'private malformed note', createdAt: '2026-08-03T12:40:00.000Z' });
  const report = buildEventOutcomeReport(input);
  const serialized = JSON.stringify(report);
  const csv = eventOutcomeCsv(report);

  for (const forbidden of ['private alpha note', 'private beta note', 'private malformed note', uuid.founderA, uuid.pitchA1]) {
    assert.equal(serialized.includes(forbidden), false);
    assert.equal(csv.includes(forbidden), false);
  }
});

test('quotes CSV fields and neutralizes formulas hidden behind whitespace or controls', () => {
  const report = buildEventOutcomeReport(fixture());
  report.founders[0].founderName = '  =HYPERLINK("https://bad.example")';
  report.founders[0].email = '\t+cmd@example.com';
  report.founders[0].commonImprovementSignals = ['line one\n@SUM(1,2)'];
  const csv = eventOutcomeCsv(report);

  assert.match(csv, /"'  =HYPERLINK\(""https:\/\/bad\.example""\)"/);
  assert.match(csv, /"'\t\+cmd@example\.com"/);
  assert.match(csv, /"line one\n@SUM\(1,2\)"/);
  assert.equal(csv.includes('pitchA1'), false);
});
