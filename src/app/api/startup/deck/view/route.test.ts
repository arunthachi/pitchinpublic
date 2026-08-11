import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { GET } from './route';

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

const request = () => new NextRequest('https://app.test/api/startup/deck/view');

test('the own-deck view fails closed when deck storage is not configured', async () => {
  await withoutSupabaseEnv(async () => {
    const response = await GET(request());
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.success, false);
    assert.match(body.error, /not configured/i);
    // A misconfigured environment must never fall through to a signed URL.
    assert.equal(body.url, undefined);
  });
});

test('the own-deck view never exposes a URL on a failure path', async () => {
  await withoutSupabaseEnv(async () => {
    const body = await (await GET(request())).json();
    assert.ok(!('url' in body), 'a failure response must not carry a deck URL');
  });
});

test('the route exposes only GET', () => {
  const handlers = require('./route') as Record<string, unknown>;
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    assert.equal(handlers[method], undefined, `${method} must not be exported`);
  }
  assert.equal(typeof handlers.GET, 'function');
});
