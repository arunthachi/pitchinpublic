import assert from 'node:assert/strict';
import test from 'node:test';
import {
  APP_DESTINATIONS,
  destination,
  eventDashboardDestination,
  profileNavigationLinks,
} from './app-navigation';

test('uses one consistent destination vocabulary', () => {
  assert.equal(APP_DESTINATIONS.events.href, '/events');
  assert.equal(APP_DESTINATIONS.pitchRooms.href, '/events?view=joined#events-joined');
  assert.equal(APP_DESTINATIONS.myEvents.href, '/events?view=managed#events-managed');
  assert.equal(APP_DESTINATIONS.eventWorkspaces.href, '/events?view=team#events-team');
  assert.equal(destination('feed', true).current, true);
});

test('encodes event dashboard slugs', () => {
  assert.deepEqual(eventDashboardDestination('demo day'), {
    label: 'Dashboard',
    href: '/events/demo%20day/dashboard',
    current: false,
  });
});

test('shows the events destination only on the signed-in user own profile', () => {
  assert.deepEqual(profileNavigationLinks(true), [
    { label: 'Feed', href: '/', current: false },
    { label: 'My pitches', href: '/me', current: true },
    { label: 'Events', href: '/events', current: false },
  ]);
  assert.deepEqual(profileNavigationLinks(false), [
    { label: 'Feed', href: '/', current: false },
  ]);
});
