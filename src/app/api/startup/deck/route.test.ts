import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { DELETE, GET, POST } from './route';

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

test('every method returns a safe 503 when deck storage is not configured', async () => {
  await withoutSupabaseEnv(async () => {
    const getResponse = await GET(new NextRequest('https://app.test/api/startup/deck'));
    assert.equal(getResponse.status, 503);

    const postResponse = await POST(
      new NextRequest('https://app.test/api/startup/deck', {
        method: 'POST',
        body: JSON.stringify({ kind: 'link', url: 'https://drive.google.com/x' }),
      })
    );
    assert.equal(postResponse.status, 503);

    const deleteResponse = await DELETE(
      new NextRequest('https://app.test/api/startup/deck', { method: 'DELETE' })
    );
    assert.equal(deleteResponse.status, 503);

    const body = await getResponse.json();
    assert.equal(body.success, false);
    assert.match(body.error, /not configured/i);
  });
});
