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

test('visibility changes use the owner-authorized queue lock protocol', async () => {
  const calls: Array<[string, unknown]> = [];
  const stub: any = {
    rpc(name: string, payload: Record<string, unknown>) {
      calls.push(['rpc', name]);
      calls.push(['payload', payload]);
      return Promise.resolve({ data: null, error: null });
    },
  };

  const result = await ownerScopedVisibilityUpdate(stub, {
    pitchId: 'pitch-1',
    visibility: 'public',
  });

  assert.deepEqual(calls[0], ['rpc', 'update_pitch_visibility_locked']);
  assert.deepEqual(calls[1], ['payload', { target_pitch_id: 'pitch-1', target_visibility: 'public' }]);
  // A non-owner (or missing) pitch matches zero rows -> null data, which the
  // route converts to the identical 404 used for missing pitches.
  assert.equal(result.data, null);
});
