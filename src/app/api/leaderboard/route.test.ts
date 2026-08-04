import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { GET } from './route';

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

    assert.equal(response.status, 500);
    assert.deepEqual(body, {
      success: false,
      error: 'Failed to fetch leaderboard',
    });
  } finally {
    console.error = previousConsoleError;
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousKey;
  }
});
