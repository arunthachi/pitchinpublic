import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { getLeaderboardOrder } from './_server';

test('orders streak and feedback leaderboards through the referenced table', () => {
  assert.deepEqual(getLeaderboardOrder('streaks'), {
    column: 'current_streak',
    options: { ascending: false, referencedTable: 'user_streaks' },
  });
  assert.deepEqual(getLeaderboardOrder('feedback'), {
    column: 'total_activities',
    options: { ascending: false, referencedTable: 'user_streaks' },
  });
});

test('returns a safe response when leaderboard storage is not configured', async () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const previousConsoleError = console.error;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  console.error = () => {};

  try {
    const response = await GET(new NextRequest('https://app.test/api/leaderboard'));
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, {
      success: true,
      leaderboard: [],
      total: 0,
      limit: 20,
      offset: 0,
      type: 'streaks',
    });
  } finally {
    console.error = previousConsoleError;
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousKey;
  }
});
