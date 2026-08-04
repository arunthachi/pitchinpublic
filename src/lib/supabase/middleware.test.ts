import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest, NextResponse } from 'next/server';
import { applySessionCookieMutation } from './middleware';

test('preserves every Supabase cookie mutation on one middleware response', () => {
  const request = new NextRequest('https://app.pitchinpublic.io/api/events');
  const response = NextResponse.next();

  applySessionCookieMutation(request, response, 'sb-access-token', 'access-value', {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
  });
  applySessionCookieMutation(request, response, 'sb-refresh-token', 'refresh-value', {
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
});

test('mirrors removal mutations without dropping existing rotated cookies', () => {
  const request = new NextRequest('https://app.pitchinpublic.io/api/events', {
    headers: { cookie: 'obsolete-token=old-value' },
  });
  const response = NextResponse.next();

  applySessionCookieMutation(request, response, 'rotated-token', 'new-value', { path: '/' });
  applySessionCookieMutation(request, response, 'obsolete-token', '', {
    maxAge: 0,
    path: '/',
  });

  assert.equal(response.cookies.get('rotated-token')?.value, 'new-value');
  assert.equal(response.cookies.get('obsolete-token')?.value, '');
  assert.match(response.headers.get('set-cookie') || '', /rotated-token=new-value/);
  assert.match(response.headers.get('set-cookie') || '', /obsolete-token=/);
});
