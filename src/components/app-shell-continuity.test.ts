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

test('the badge state reaches assistive tech, not just the DOM', () => {
  // An aria-label REPLACES descendant text for assistive tech, so an sr-only
  // span nested inside a labelled control is never announced. That is exactly
  // the bug an earlier span-counting version of this test failed to catch.
  for (const component of ['components/AppTabBar.tsx', 'components/BottomNavBar.tsx']) {
    const source = read(component);
    const dots = (source.match(/rounded-full bg-neon-lime/g) || []).length;
    assert.ok(dots > 0, `${component} renders no badge dot`);
    assert.match(
      source,
      /aria-label=\{navBadgeLabel\(/,
      `${component} must fold the badge state into its accessible name`,
    );
    assert.doesNotMatch(
      source,
      /aria-label="[^"]*"[\s\S]{0,600}?sr-only">New event invitation/,
      `${component} nests sr-only badge text inside an aria-labelled control, where it is ignored`,
    );
  }

  // SidebarNav is the exception: its control has no aria-label, so the nested
  // text IS the accessible name and is announced normally.
  const sidebar = read('components/SidebarNav.tsx');
  assert.match(sidebar, /sr-only">New event invitation/);
});

test('the badge label is appended, not substituted', () => {
  const nav = read('lib/app-navigation.ts');
  assert.match(nav, /export function navBadgeLabel/);
  // The base label must survive: "Events, new invitation", never just
  // "new invitation", or the tab loses its name when an invite is pending.
  assert.match(nav, /\$\{baseLabel\}, new invitation/);
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
  assert.match(home, /stripQueryParam\('profileEdit'\)/);
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
    /finally \{[\s\S]{0,400}?if \(!cancelled\) \{[\s\S]{0,400}?setAccessCheckComplete\(true\);\s*hasVerifiedAccessOnceRef\.current = true;/,
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
  assert.match(home, /stripQueryParam,\s*userId,\s*userProfile,\s*\]\);/);
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
  // The features string must not carry noopener/noreferrer: Chrome and Firefox
  // then return null and the fallback navigates the current tab away. Sever the
  // opener reference on the returned handle instead.
  assert.doesNotMatch(card, /window\.open\('',\s*'_blank',\s*'[^']*no(opener|referrer)/);
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

test('the shell survives every early return, not just the loaded page', () => {
  // A bare spinner or error screen with no tab bar is exactly the "detached
  // browser page" feel this work exists to remove, and it is what a founder
  // sees on a slow connection or a stale link. Each page must render the bar
  // on its loaded path AND on every early return that a signed-in founder can
  // reach, so the count tracks the number of `return (` branches guarded here.
  const EXPECTED_RENDER_SITES: Record<string, number> = {
    'app/events/page.tsx': 2, // loaded + loading (the signed-out branch is its own screen)
    'app/events/[slug]/page.tsx': 3, // loaded + loading + load failure
    'app/profile/[userId]/page.tsx': 3, // loaded + loading + not found
    'app/pitch/[id]/page.tsx': 3, // loaded + loading + not found
  };
  for (const page of TAB_BAR_PAGES) {
    const renders = (read(page).match(/<AppTabBar\b/g) || []).length;
    assert.equal(
      renders,
      EXPECTED_RENDER_SITES[page],
      `${page} renders AppTabBar ${renders} time(s) — an early return drops the shell`,
    );
  }
});

test('the create-event form opts out of the one-tap close', () => {
  // The X sits beside the account button as the rightmost thumb target at
  // 390px; on a form holding a draft event and its invite list, one stray tap
  // would discard the lot with no confirmation and no beforeunload.
  assert.match(read('app/events/new/page.tsx'), /showClose=\{false\}/);
});

test('a reviewer is not offered a Record tab that cannot work', () => {
  const bar = read('components/AppTabBar.tsx');
  assert.match(bar, /APP_MODE_KEY/);
  assert.match(bar, /filter\(\(tab\) => tab\.key !== 'record'\)/);

  // And the handler must consume a stuck ?record=1 rather than leave it armed
  // to fire when the same session later switches to founder mode.
  const home = read('app/page.tsx');
  assert.match(home, /if \(reviewerMode\) \{\s*handledRecordQueryRef\.current = true;\s*stripQueryParam\('record'\);/);
});

test('no deck response is cacheable, including the shared guard responses', () => {
  // A signed URL is a bearer capability; a shared cache must not hand one
  // founder's URL to another client. The guard responses (401/403/409/503)
  // come from deck-owner.ts, so counting only the route file would miss them —
  // which is exactly what an earlier version of this assertion did.
  for (const file of ['app/api/startup/deck/view/route.ts', 'lib/deck-owner.ts']) {
    const source = read(file);
    assert.match(source, /'Cache-Control': 'private, no-store'/, `${file} defines no no-store header`);
    const responses = (source.match(/NextResponse\.json\(/g) || []).length;
    const noStore = (source.match(/NO_STORE/g) || []).length - 1; // minus the definition
    assert.equal(noStore, responses, `${file}: ${responses} response(s) but ${noStore} marked no-store`);
  }
});

test('every deck failure response carries a machine-readable code', () => {
  for (const file of ['app/api/startup/deck/view/route.ts', 'lib/deck-owner.ts']) {
    const source = read(file);
    const failures = (source.match(/success: false/g) || []).length;
    const codes = (source.match(/code: '[a-z_]+'/g) || []).length;
    assert.equal(codes, failures, `${file}: ${failures} failure(s) but ${codes} code field(s)`);
  }
});

test('a stored deck link is re-validated before it is handed back', () => {
  // Validation runs at write today, but a row predating that rule must not
  // yield a javascript: URL that the opener tab executes in this origin.
  assert.match(read('app/api/startup/deck/view/route.ts'), /validateDeckLink\(deck\.link_url\)/);
});

test('the recorder deep link waits until the server has stated the role', () => {
  const home = read('app/page.tsx');
  // accessCheckComplete is already true while signed out, so completing an OTP
  // on /?record=1 would otherwise open the studio on the render before the
  // access effect re-runs. And "a check ran" is not the same as "the role is
  // known": a failed lookup still completes the check, so gating on that alone
  // hands the recorder to a reviewer-only account whenever the network blips.
  assert.match(home, /if \(!roleResolved\) return;/);
  assert.match(home, /roleResolved = reviewerResponse\.ok;/);
  assert.match(home, /roleResolved, searchParams/);
});

test('role confidence resets on sign-out and never blocks the UI', () => {
  const home = read('app/page.tsx');
  // The reset branch must clear it, or the next account inherits the last
  // account's role confidence.
  assert.match(home, /setAccessCheckComplete\(true\);\s*setRoleResolved\(false\);/);
  // A failed check must still complete: leaving the access gate up is the
  // roadblock this area exists to prevent.
  assert.match(home, /setAccessCheckComplete\(true\);\s*hasVerifiedAccessOnceRef\.current = true;/);
});
