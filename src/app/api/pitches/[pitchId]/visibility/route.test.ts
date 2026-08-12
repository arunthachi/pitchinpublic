import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { POST } from './route';
import { ownerScopedVisibilityUpdate, visibilityUpdateSchema } from './_server';

test('visibility accepts only public or private', () => {
  assert.equal(visibilityUpdateSchema.safeParse({ visibility: 'public' }).success, true);
  assert.equal(visibilityUpdateSchema.safeParse({ visibility: 'private' }).success, true);
  assert.equal(visibilityUpdateSchema.safeParse({ visibility: 'unlisted' }).success, false);
  assert.equal(visibilityUpdateSchema.safeParse({ visibility: 'public', extra: 1 }).success, false);
});

test('non-uuid pitch ids 404 before touching any backend', async () => {
  const response = await POST(
    new NextRequest('https://app.test/api/pitches/fuzz/visibility', { method: 'POST' }),
    { params: Promise.resolve({ pitchId: 'fuzz' }) },
  );
  assert.equal(response.status, 404);
});

test('returns a safe 503 when unconfigured', async () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  try {
    const response = await POST(
      new NextRequest('https://app.test/api/pitches/70d46f48-2f9b-4a3c-9500-8309a86e7639/visibility', { method: 'POST' }),
      { params: Promise.resolve({ pitchId: '70d46f48-2f9b-4a3c-9500-8309a86e7639' }) },
    );
    assert.equal(response.status, 503);
  } finally {
    if (previousUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey !== undefined) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousKey;
  }
});

test('the update is owner-scoped: id, user_id, and deleted_at filters all apply', async () => {
  const calls: Array<[string, unknown]> = [];
  const stub: any = {
    from(table: string) { calls.push(['from', table]); return stub; },
    update(payload: Record<string, unknown>) { calls.push(['update', payload]); return stub; },
    eq(column: string, value: unknown) { calls.push(['eq', `${column}=${value}`]); return stub; },
    is(column: string, value: unknown) { calls.push(['is', `${column}=${value}`]); return stub; },
    select(columns: string) { calls.push(['select', columns]); return stub; },
    maybeSingle: async () => ({ data: null, error: null }),
  };

  const result = await ownerScopedVisibilityUpdate(stub, {
    pitchId: 'pitch-1',
    userId: 'owner-1',
    visibility: 'public',
  });

  assert.deepEqual(calls[0], ['from', 'pitches']);
  assert.equal((calls[1][1] as any).visibility, 'public');
  assert.deepEqual(calls[2], ['eq', 'id=pitch-1']);
  assert.deepEqual(calls[3], ['eq', 'user_id=owner-1'], 'update must be scoped to the caller');
  assert.deepEqual(calls[4], ['is', 'deleted_at=null']);
  assert.equal(String(calls[5][1]).includes('visibility'), true);
  // A non-owner (or missing) pitch matches zero rows -> null data, which the
  // route converts to the identical 404 used for missing pitches.
  assert.equal(result.data, null);
});
