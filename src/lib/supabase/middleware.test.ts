import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest, NextResponse } from 'next/server';
import { applySessionCookieMutation, shouldValidateSession } from './middleware';

test('validates API sessions without adding auth latency to pages or health checks', () => {
  assert.equal(shouldValidateSession('/api/events'), true);
  assert.equal(shouldValidateSession('/api/pitches/upload-url'), true);
  assert.equal(shouldValidateSession('/api/health'), false);
  assert.equal(shouldValidateSession('/api/health/ready'), false);
  assert.equal(shouldValidateSession('/events/new'), false);
  assert.equal(shouldValidateSession('/about'), false);
});

test('preserves every Supabase cookie mutation on one middleware response', () => {
  const request = new NextRequest('https://app.pitchinpublic.io/api/events');
  let response = NextResponse.next({ request: { headers: request.headers } });

  response = applySessionCookieMutation(request, response, 'sb-access-token', 'access-value', {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
  });
  response = applySessionCookieMutation(request, response, 'sb-refresh-token', 'refresh-value', {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
  });

  assert.equal(request.cookies.get('sb-access-token')?.value, 'access-value');
  assert.equal(request.cookies.get('sb-refresh-token')?.value, 'refresh-value');
  assert.equal(response.cookies.get('sb-access-token')?.value, 'access-value');
  assert.equal(response.cookies.get('sb-refresh-token')?.value, 'refresh-value');
  assert.match(response.headers.get('set-cookie') || '', /sb-access-token=access-value/);
  assert.match(response.headers.get('set-cookie') || '', /sb-refresh-token=refresh-value/);
  assert.match(response.headers.get('x-middleware-request-cookie') || '', /sb-access-token=access-value/);
  assert.match(response.headers.get('x-middleware-request-cookie') || '', /sb-refresh-token=refresh-value/);
});

test('mirrors removal mutations without dropping existing rotated cookies', () => {
  const request = new NextRequest('https://app.pitchinpublic.io/api/events', {
    headers: { cookie: 'obsolete-token=old-value' },
  });
  let response = NextResponse.next({ request: { headers: request.headers } });

  response = applySessionCookieMutation(request, response, 'rotated-token', 'new-value', { path: '/' });
  response = applySessionCookieMutation(request, response, 'obsolete-token', '', {
    maxAge: 0,
    path: '/',
  });

  assert.equal(response.cookies.get('rotated-token')?.value, 'new-value');
  assert.equal(response.cookies.get('obsolete-token')?.value, '');
  assert.match(response.headers.get('set-cookie') || '', /rotated-token=new-value/);
  assert.match(response.headers.get('set-cookie') || '', /obsolete-token=/);
  const forwardedCookie = response.headers.get('x-middleware-request-cookie') || '';
  assert.match(forwardedCookie, /rotated-token=new-value/);
  assert.doesNotMatch(forwardedCookie, /obsolete-token=old-value/);
});
