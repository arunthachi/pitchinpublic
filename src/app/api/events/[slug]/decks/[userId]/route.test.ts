import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { GET, buildDeckAccessContext } from './route';
import { canViewDeck } from '@/lib/pitch-deck';

const OWNER = '11111111-1111-4111-8111-111111111111';
const ORGANIZER = '22222222-2222-4222-8222-222222222222';
const OTHER = '33333333-3333-4333-8333-333333333333';

function withoutSupabaseEnv<T>(run: () => Promise<T>) {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return run().finally(() => {
    if (previousUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey !== undefined) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousKey;
  });
}

test('builds access context with requester and owner resolved from participant rows', () => {
  const context = buildDeckAccessContext({
    requesterId: OTHER,
    ownerId: OWNER,
    organizerId: ORGANIZER,
    participantRows: [
      { user_id: OTHER, role: 'coach', status: 'active' },
      { user_id: OWNER, role: 'founder', status: 'active' },
    ],
    isPlatformAdmin: false,
  });
  assert.equal(context.event?.requesterRole, 'coach');
  assert.equal(context.event?.ownerRole, 'founder');
  assert.equal(canViewDeck(context), true);
});

test('a requester asking for their own deck maps one row to both sides', () => {
  const context = buildDeckAccessContext({
    requesterId: OWNER,
    ownerId: OWNER,
    organizerId: ORGANIZER,
    participantRows: [{ user_id: OWNER, role: 'founder', status: 'active' }],
    isPlatformAdmin: false,
  });
  assert.equal(context.event?.requesterRole, 'founder');
  assert.equal(context.event?.ownerRole, 'founder');
  assert.equal(canViewDeck(context), true);
});

test('missing participant rows leave roles undefined and access denied for outsiders', () => {
  const context = buildDeckAccessContext({
    requesterId: OTHER,
    ownerId: OWNER,
    organizerId: ORGANIZER,
    participantRows: [],
    isPlatformAdmin: false,
  });
  assert.equal(context.event?.requesterRole, undefined);
  assert.equal(canViewDeck(context), false);
});

test('rows for unrelated users never leak into the context', () => {
  const context = buildDeckAccessContext({
    requesterId: OTHER,
    ownerId: OWNER,
    organizerId: ORGANIZER,
    participantRows: [{ user_id: ORGANIZER, role: 'organizer', status: 'active' }],
    isPlatformAdmin: false,
  });
  assert.equal(context.event?.requesterRole, undefined);
  assert.equal(context.event?.ownerRole, undefined);
  assert.equal(canViewDeck(context), false);
});

test('rejects a non-uuid userId with 404 before touching any backend', async () => {
  const response = await withoutSupabaseEnv(() =>
    GET(new NextRequest('https://app.test/api/events/demo/decks/not-a-uuid'), {
      params: Promise.resolve({ slug: 'demo', userId: 'not-a-uuid' }),
    })
  );
  assert.equal(response.status, 404);
  const body = await response.json();
  assert.equal(body.success, false);
});

test('returns 503 when deck storage is not configured', async () => {
  const response = await withoutSupabaseEnv(() =>
    GET(new NextRequest(`https://app.test/api/events/demo/decks/${OWNER}`), {
      params: Promise.resolve({ slug: 'demo', userId: OWNER }),
    })
  );
  assert.equal(response.status, 503);
});
