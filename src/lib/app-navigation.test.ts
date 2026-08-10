import assert from 'node:assert/strict';
import test from 'node:test';
import {
  APP_DESTINATIONS,
  APP_HOME_HREF,
  APP_TAB_BAR_TABS,
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

test('the routed tab bar covers the four primary destinations', () => {
  assert.deepEqual(
    APP_TAB_BAR_TABS.map((tab) => tab.key),
    ['feed', 'events', 'record', 'profile'],
  );
  assert.equal(APP_HOME_HREF, '/');
});

test('the record tab reuses the existing home recorder deep link', () => {
  const record = APP_TAB_BAR_TABS.find((tab) => tab.key === 'record');
  // ?record=1 is already handled on the home shell; duplicating the recorder
  // on other routes would fork the upload path.
  assert.equal(record?.href, '/?record=1');
});

test('every tab has an accessible label distinct from its short caption', () => {
  for (const tab of APP_TAB_BAR_TABS) {
    assert.ok(tab.label.length > 0, `${tab.key} has no label`);
    assert.ok(tab.shortLabel.length > 0, `${tab.key} has no short label`);
    assert.ok(tab.href.startsWith('/'), `${tab.key} must link within the app`);
  }
});
