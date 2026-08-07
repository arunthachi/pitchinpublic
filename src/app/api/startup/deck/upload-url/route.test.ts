import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { POST } from './route';

test('returns a safe 503 when deck storage is not configured', async () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  try {
    const response = await POST(
      new NextRequest('https://app.test/api/startup/deck/upload-url', {
        method: 'POST',
        body: JSON.stringify({ fileName: 'deck.pdf', fileSize: 1024, mimeType: 'application/pdf' }),
      })
    );
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.success, false);
  } finally {
    if (previousUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey !== undefined) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousKey;
  }
});
