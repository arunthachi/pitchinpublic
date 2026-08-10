import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

/**
 * Wiring assertions, deliberately source-level. A previous slice shipped two
 * fixes whose helper unit tests passed while the components never received the
 * props — the mobile render sites were missed. These tests fail if a founder
 * surface stops rendering the shell.
 */

const ROOT = path.join(process.cwd(), 'src');

function read(relativePath: string) {
  return readFileSync(path.join(ROOT, relativePath), 'utf8');
}

const TAB_BAR_PAGES = [
  'app/events/page.tsx',
  'app/events/[slug]/page.tsx',
  'app/profile/[userId]/page.tsx',
  'app/pitch/[id]/page.tsx',
];

test('every founder surface renders the routed tab bar', () => {
  for (const page of TAB_BAR_PAGES) {
    const source = read(page);
    assert.match(
      source,
      /import AppTabBar from '@\/components\/AppTabBar';/,
      `${page} does not import AppTabBar`,
    );
    assert.match(source, /<AppTabBar\b/, `${page} imports AppTabBar but never renders it`);
  }
});

test('tab-bar pages reserve space including the home-indicator inset', () => {
  for (const page of TAB_BAR_PAGES) {
    // A flat 7rem covered the bar's nominal height but not the safe-area inset,
    // so on a 34px home-indicator iPhone the bar sat over the last line.
    assert.match(
      read(page),
      /pb-\[calc\(7rem\+env\(safe-area-inset-bottom\)\)\]/,
      `${page} does not reserve safe-area space for the fixed tab bar`,
    );
  }
});

test('the tab bar is mobile-only so it never collides with the desktop sidebar', () => {
  assert.match(read('components/AppTabBar.tsx'), /lg:hidden/);
});

test('action pages expose a close control back to the feed', () => {
  const nav = read('components/ActionPageNav.tsx');
  assert.match(nav, /showClose = true/, 'the close control must be on by default');
  assert.match(nav, /aria-label="Close and return to the feed"/);
  assert.match(nav, /closeHref = APP_HOME_HREF/);
});

test('every nav badge dot carries a screen-reader equivalent', () => {
  for (const component of ['components/BottomNavBar.tsx', 'components/SidebarNav.tsx', 'components/AppTabBar.tsx']) {
    const source = read(component);
    const dots = source.match(/rounded-full bg-neon-lime/g) || [];
    const labels = source.match(/sr-only">New event invitation/g) || [];
    assert.equal(
      labels.length,
      dots.length,
      `${component} has ${dots.length} badge dot(s) but ${labels.length} screen-reader label(s)`,
    );
  }
});

test('the founder deck card is rendered only on the owner own profile', () => {
  const profile = read('app/profile/[userId]/page.tsx');
  assert.match(profile, /import ProfileDeckCard from '@\/components\/ProfileDeckCard';/);
  assert.match(profile, /\{isOwnProfile \? \(\s*<ProfileDeckCard/);
});

test('the own-deck endpoint resolves the company from the session, not from input', () => {
  const route = read('app/api/startup/deck/view/route.ts');
  assert.match(route, /requireDeckOwnerContext\(request\)/);
  assert.doesNotMatch(
    route,
    /searchParams\.get|params\./,
    'the own-deck endpoint must not accept a caller-supplied identifier',
  );
});

test('the profile edit deep link is handled on the home shell', () => {
  const home = read('app/page.tsx');
  assert.match(home, /searchParams\.get\('profileEdit'\) !== '1'/);
  assert.match(home, /url\.searchParams\.delete\('profileEdit'\)/);
});

test('no user-facing copy calls an event a pitch room', () => {
  const offenders: string[] = [];
  for (const file of [
    'app/organizer/invite/page.tsx',
    'app/pip-super-admin/page.tsx',
    'components/WelcomeHero.tsx',
    'lib/nudges.ts',
  ]) {
    if (/pitch[ -]?room/i.test(read(file))) offenders.push(file);
  }
  assert.deepEqual(offenders, []);
});

test('signing out cannot leave a verified-access ref behind', () => {
  const home = read('app/page.tsx');
  // The reset branch must clear every piece of access state, and the async
  // verifier must never write after its effect run was cancelled — otherwise a
  // request in flight during sign-out re-marks the session as verified.
  for (const reset of [
    /hasVerifiedAccessOnceRef\.current = false;/,
    /setHasVerifiedAccessOnce\(false\);/,
    /lastAccessCheckAtRef\.current = null;/,
    /verifyPilotAccessRef\.current = null;/,
  ]) {
    assert.match(home, reset, `sign-out reset is missing ${reset}`);
  }
  assert.match(
    home,
    /finally \{\s*if \(!cancelled\) \{\s*setAccessCheckComplete\(true\);\s*hasVerifiedAccessOnceRef\.current = true;/,
    'the verifier must gate its completion writes on the cancelled flag',
  );
});

test('the profile edit deep link fires once, not on every auth republish', () => {
  const home = read('app/page.tsx');
  // history.replaceState does not refresh useSearchParams, so the query stays
  // '1' for the life of the page; without the one-shot ref the modal reopens
  // itself after the user closes it.
  assert.match(home, /if \(handledProfileEditQueryRef\.current\) return;/);
  assert.match(home, /handledProfileEditQueryRef\.current = true;/);
  // Keyed on the id, never the user object — see the access-gate regression.
  assert.match(home, /searchParams, userId, userProfile\]\);/);
  // The recorder deep link shares the contract: the Record tab routes through
  // it, and reopening the studio after the founder closed it loses the take.
  assert.match(home, /if \(handledRecordQueryRef\.current\) return;/);
  assert.doesNotMatch(
    home,
    /\}, \[accessCheckComplete, loading, reviewerMode, searchParams, user\]\);/,
    'a query-param effect is still keyed on the user object',
  );
});

test('the deck opens in a new tab rather than replacing the profile', () => {
  const card = read('components/ProfileDeckCard.tsx');
  // Chrome and Firefox return null from window.open when `noopener` is in the
  // features string, which would send the fallback down window.location and
  // navigate the current tab away from the profile.
  assert.doesNotMatch(card, /window\.open\([^)]*noopener/);
  assert.match(card, /window\.open\('', '_blank'\)/);
  assert.match(card, /target\.opener = null/);
});

test('the profile edit deep link waits for the profile fetch and honours founder intent', () => {
  const home = read('app/page.tsx');
  // Opening mid-fetch would let ProfileEditModal's reset effect wipe fields the
  // founder had already typed, because it re-runs when the current* props land.
  assert.match(home, /if \(!userProfile\) return;/);
  // A dual-role user clicking "edit my founder profile" gets the founder editor
  // rather than a dead button; a reviewer with no founder access is left alone.
  assert.match(home, /if \(reviewerMode\) \{\s*if \(!founderAccess\) return;/);
});

test('the shell survives the loading state, not just the loaded page', () => {
  // A spinner with no tab bar is exactly the "detached browser page" feel this
  // work exists to remove, and it is what a founder sees on a slow connection.
  for (const page of TAB_BAR_PAGES) {
    const source = read(page);
    const renders = (source.match(/<AppTabBar\b/g) || []).length;
    assert.ok(
      renders >= 2,
      `${page} renders AppTabBar ${renders} time(s) — the loading branch drops the shell`,
    );
  }
});
