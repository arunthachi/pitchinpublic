import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { isAppOwnedPath, isMarketingHomeRequest, isPrivateHtmlPath, proxy, requestHost } from './proxy';

test('prefers the forwarded hostname and strips its port', () => {
  const headers = new Headers({
    host: '127.0.0.1:3000',
    'x-forwarded-host': 'www.pitchinpublic.io:443',
  });
  assert.equal(requestHost({ headers } as never), 'www.pitchinpublic.io');
});

test('classifies private application HTML without hiding public marketing routes', () => {
  assert.equal(isPrivateHtmlPath('/events/demo/dashboard'), true);
  assert.equal(isPrivateHtmlPath('/founder/invite'), true);
  assert.equal(isPrivateHtmlPath('/pip-super-admin'), true);
  assert.equal(isPrivateHtmlPath('/for-events'), false);
  assert.equal(isPrivateHtmlPath('/founders'), false);
  assert.equal(isPrivateHtmlPath('/pitch/public-id'), false);
});

test('classifies app-owned public and private paths without claiming marketing routes', () => {
  assert.equal(isAppOwnedPath('/leaderboard'), true);
  assert.equal(isAppOwnedPath('/pitch/public-id'), true);
  assert.equal(isAppOwnedPath('/events/demo'), true);
  assert.equal(isAppOwnedPath('/for-events'), false);
});

test('serves the organizer-led homepage only at the canonical marketing host root', () => {
  assert.equal(isMarketingHomeRequest('www.pitchinpublic.io', '/'), true);
  assert.equal(isMarketingHomeRequest('app.pitchinpublic.io', '/'), false);
  assert.equal(isMarketingHomeRequest('www.pitchinpublic.io', '/founders'), false);
});

test('rewrites the marketing hostname root and redirects its internal route', async () => {
  const home = new NextRequest('https://www.pitchinpublic.io/', {
    headers: { host: 'www.pitchinpublic.io' },
  });
  const rewritten = await proxy(home);
  assert.equal(rewritten.headers.get('x-middleware-rewrite'), 'https://www.pitchinpublic.io/marketing-home');

  const internal = new NextRequest('https://www.pitchinpublic.io/marketing-home', {
    headers: { host: 'www.pitchinpublic.io' },
  });
  const redirected = await proxy(internal);
  assert.equal(redirected.status, 308);
  assert.equal(redirected.headers.get('location'), 'https://www.pitchinpublic.io/');
});

test('adds crawler protection to private HTML responses', async () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

  try {
    const request = new NextRequest('https://app.pitchinpublic.io/events/demo', {
      headers: { host: 'app.pitchinpublic.io' },
    });
    const response = await proxy(request);
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
  } finally {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousKey;
  }
});

test('redirects app-owned routes away from the marketing host', async () => {
  const request = new NextRequest('https://www.pitchinpublic.io/leaderboard?period=week', {
    headers: { host: 'www.pitchinpublic.io' },
  });
  const response = await proxy(request);
  assert.equal(response.status, 308);
  assert.equal(response.headers.get('location'), 'https://app.pitchinpublic.io/leaderboard?period=week');
});
