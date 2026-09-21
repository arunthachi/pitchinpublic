import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { NextRequest } from 'next/server';
import { buildConfirmationEmail, buildLeadRateLimitKey, isDuplicateLeadInsert, leadSchema, POST, selectTighterRateLimit } from './route';

const REQUEST_ID = '123e4567-e89b-42d3-a456-426614174000';

function leadRequest(body: string, ip: string) {
  return new NextRequest('https://www.pitchinpublic.io/api/leads', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body,
  });
}

test('lead validation normalizes email and rejects malformed requests', () => {
  const valid = leadSchema.parse({
    requestId: REQUEST_ID,
    type: 'founder',
    email: '  Founder@Example.com ',
    name: ' Example Co ',
  });

  assert.equal(valid.email, 'founder@example.com');
  assert.equal(valid.name, 'Example Co');
  assert.equal(leadSchema.safeParse({ requestId: REQUEST_ID, type: 'founder', email: 'not-an-email', name: 'Example Co' }).success, false);
  assert.equal(leadSchema.safeParse({ type: 'founder', email: 'founder@example.com', name: 'Example Co' }).success, false);
});

test('lead identity rate-limit keys are normalized, IP-independent, and HMAC-protected', () => {
  const normalized = buildLeadRateLimitKey({ type: 'founder', email: 'founder@example.com' }, 'test-secret');
  const equivalent = buildLeadRateLimitKey({ type: 'founder', email: ' Founder@Example.com ' }, 'test-secret');
  const otherRole = buildLeadRateLimitKey({ type: 'organizer', email: 'founder@example.com' }, 'test-secret');
  const otherSecret = buildLeadRateLimitKey({ type: 'founder', email: 'founder@example.com' }, 'other-secret');

  assert.equal(normalized, equivalent);
  assert.notEqual(normalized, otherRole);
  assert.notEqual(normalized, otherSecret);
  assert.doesNotMatch(normalized, /founder@example\.com/);
});

test('database conflicts identify concurrent retries by their client-stable request id', () => {
  assert.equal(leadSchema.parse({ requestId: REQUEST_ID, type: 'organizer', email: 'team@example.com', name: 'Team' }).requestId, REQUEST_ID);
  assert.equal(isDuplicateLeadInsert({ code: '23505' }), true);
  assert.equal(isDuplicateLeadInsert({ code: '42501' }), false);
});

test('response rate-limit metadata represents the tighter active limit', () => {
  const ipTighter = selectTighterRateLimit({ remaining: 2, name: 'ip' }, { remaining: 4, name: 'identity' });
  const identityTighter = selectTighterRateLimit({ remaining: 7, name: 'ip' }, { remaining: 3, name: 'identity' });

  assert.equal(ipTighter.name, 'ip');
  assert.equal(identityTighter.name, 'identity');
});

test('confirmation links use the canonical marketing founder and organizer routes', () => {
  const founderEmail = buildConfirmationEmail({
    requestId: REQUEST_ID,
    type: 'founder',
    email: 'founder@example.com',
    name: 'Example Co',
    website: '',
    source: 'test',
  });
  const organizerEmail = buildConfirmationEmail({
    requestId: '123e4567-e89b-42d3-a456-426614174001',
    type: 'organizer',
    email: 'organizer@example.com',
    name: 'Example Program',
    website: '',
    source: 'test',
  });

  assert.match(founderEmail.html, /https:\/\/www\.pitchinpublic\.io\/founders/);
  assert.match(founderEmail.text, /https:\/\/www\.pitchinpublic\.io\/founders/);
  assert.doesNotMatch(founderEmail.html, /for-founders/);
  assert.match(organizerEmail.html, /https:\/\/www\.pitchinpublic\.io\/for-events/);
});

test('the public lead response does not echo stored identity or delivery state', async () => {
  const source = await readFile(new URL('./route.ts', import.meta.url), 'utf8');
  const responseBlock = source.slice(source.lastIndexOf('return NextResponse.json(', source.lastIndexOf('} catch')));

  assert.doesNotMatch(responseBlock, /^\s*confirmationStatus,\s*$/m);
  assert.doesNotMatch(responseBlock, /^\s*notificationStatus,\s*$/m);
  assert.doesNotMatch(responseBlock, /lead:\s*\{/);
  assert.match(source, /lead-capture:\$\{getClientIp\(request\)\}/);
  assert.match(source, /buildLeadRateLimitKey\(lead, identitySecret\)/);
  assert.match(source, /\.gte\('created_at', recentCutoff\)/);
});

test('POST rejects invalid lead fields with rate-limit headers', async () => {
  const response = await POST(leadRequest(JSON.stringify({ requestId: REQUEST_ID, type: 'founder', email: 'invalid' }), '198.51.100.10'));
  assert.equal(response.status, 400);
  assert.equal(response.headers.get('x-ratelimit-limit'), '10');
  assert.deepEqual(await response.json(), { success: false, error: 'Check the form fields and try again.' });
});

test('POST fails safely when storage is not configured', async () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  try {
    const response = await POST(leadRequest(JSON.stringify({
      requestId: '123e4567-e89b-42d3-a456-426614174002',
      type: 'organizer',
      email: 'organizer@example.com',
      name: 'Example Accelerator',
    }), '198.51.100.11'));
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      success: false,
      error: 'We could not save your request right now. Please email hello@pitchinpublic.io.',
    });
  } finally {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousAnonKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousAnonKey;
  }
});

test('POST returns a generic error for malformed JSON', async () => {
  const response = await POST(leadRequest('{', '198.51.100.12'));
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    success: false,
    error: 'Something went wrong. Please email hello@pitchinpublic.io.',
  });
});

test('POST rate-limits repeated lead attempts from the same client', async () => {
  let response: Response | undefined;
  for (let attempt = 0; attempt < 11; attempt += 1) {
    response = await POST(leadRequest(JSON.stringify({ requestId: '123e4567-e89b-42d3-a456-426614174003', type: 'founder', email: 'invalid' }), '198.51.100.13'));
  }

  assert.equal(response?.status, 429);
  assert.equal(response?.headers.get('retry-after') !== null, true);
  assert.deepEqual(await response?.json(), {
    success: false,
    error: 'Too many requests. Please wait before trying again.',
  });
});
