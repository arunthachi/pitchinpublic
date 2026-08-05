import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEventInviteEmail, trustedHttpUrl } from './email';

test('renders a founder acceptance button and fallback URL', () => {
  const invite = buildEventInviteEmail({
    eventName: 'Demo <Day>',
    inviteUrl: 'https://example.com/events/demo?invite=a&role=founder',
    role: 'founder',
  });
  assert.match(invite.html, />Accept event invite<\/a>/);
  assert.match(invite.html, /https:\/\/example\.com\/events\/demo\?invite=a&amp;role=founder/);
  assert.doesNotMatch(invite.html, /Demo <Day>/);
  assert.match(invite.text, /Accept event invite: https:\/\/example\.com/);
});

test('uses an acceptance label for event team invitations', () => {
  const invite = buildEventInviteEmail({
    eventName: 'Demo Day',
    inviteUrl: 'https://example.com/invite',
    role: 'judge',
  });
  assert.match(invite.html, /Accept event team invite/);
  assert.doesNotMatch(invite.html, /Open event dashboard/);
});

test('refuses non-http invite schemes', () => {
  assert.equal(trustedHttpUrl('javascript:alert(1)'), null);
  const invite = buildEventInviteEmail({
    eventName: 'Demo Day',
    inviteUrl: 'javascript:alert(1)',
  });
  assert.doesNotMatch(invite.html, /href=/);
  assert.doesNotMatch(invite.html, /javascript:/);
  assert.match(invite.text, /new secure invite link/);
});
