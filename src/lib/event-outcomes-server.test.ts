import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import { isOutcomeReportManager, loadEventOutcomeReport, type OutcomeAccess } from './event-outcomes-server';

const request = {} as NextRequest;
const event = {
  id: '00000000-0000-4000-8000-000000000001',
  organizer_id: '00000000-0000-4000-8000-000000000002',
  name: 'Demo Day',
  slug: 'demo-day',
  event_date: '2026-08-15',
  submission_deadline: null,
};

test('allows only the owner or an active organizer/admin', () => {
  assert.equal(isOutcomeReportManager('owner', 'owner', null), true);
  assert.equal(isOutcomeReportManager('owner', 'member', { role: 'organizer', status: 'active' }), true);
  assert.equal(isOutcomeReportManager('owner', 'member', { role: 'admin', status: 'active' }), true);
  assert.equal(isOutcomeReportManager('owner', 'member', { role: 'coach', status: 'active' }), false);
  assert.equal(isOutcomeReportManager('owner', 'member', { role: 'judge', status: 'active' }), false);
  assert.equal(isOutcomeReportManager('owner', 'member', { role: 'organizer', status: 'removed' }), false);
});

for (const access of [
  { ok: false, status: 401, error: 'Authentication required' },
  { ok: false, status: 403, error: 'Organizer access required' },
  { ok: false, status: 404, error: 'Event not found' },
] satisfies OutcomeAccess[]) {
  test(`does not construct the service client after a ${access.status} access result`, async () => {
    let serviceConstructed = false;
    const result = await loadEventOutcomeReport(request, event.slug, {
      authorize: async () => access,
      createServiceClient: () => {
        serviceConstructed = true;
        return null;
      },
    });

    assert.deepEqual(result, access);
    assert.equal(serviceConstructed, false);
  });
}

test('returns no partial report when a required source query fails', async () => {
  const failingQuery = {
    select() { return this; },
    eq() { return this; },
    lte() { return this; },
    order() { return this; },
    then(resolve: (value: { data: null; error: { message: string } }) => unknown) {
      return Promise.resolve({ data: null, error: { message: 'late source failure' } }).then(resolve);
    },
  };
  const failingClient = {
    from() {
      return failingQuery;
    },
  } as unknown as SupabaseClient;

  const loggedErrors: unknown[][] = [];
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => loggedErrors.push(args);
  let result;
  try {
    result = await loadEventOutcomeReport(request, event.slug, {
      authorize: async () => ({ ok: true, userId: event.organizer_id, event }),
      createServiceClient: () => failingClient,
      now: () => new Date('2026-08-16T00:00:00.000Z'),
    });
  } finally {
    console.error = originalConsoleError;
  }

  assert.deepEqual(result, {
    ok: false,
    status: 500,
    error: 'Could not load the complete event outcome report.',
  });
  assert.equal('report' in result, false);
  assert.match(String(loggedErrors[0]?.[1]), /roster and submissions/);
});
