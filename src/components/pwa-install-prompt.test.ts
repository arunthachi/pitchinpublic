import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { getPwaPromptPositionClasses } from './PwaInstallPrompt';

/**
 * The install card is `fixed` over the feed and previously used a flat
 * `right-[max(1rem,env(safe-area-inset-right))]`, which sat directly over
 * FullScreenVideoFeed.tsx's vertical reaction rail (Roast / Toast / comment /
 * bookmark / share, positioned via FloatingReactions.tsx). These tests pin
 * the positioning math — extracted into getPwaPromptPositionClasses so it is
 * testable without rendering — rather than asserting on opaque class strings.
 */

const ROOT = path.join(process.cwd(), 'src', 'components');

function read(file: string) {
  return readFileSync(path.join(ROOT, file), 'utf8');
}

test('left inset and rail clearance are identical in both dock modes', () => {
  // The rail collision is about horizontal space, not the bottom-nav dock —
  // only vertical position should ever change between modes.
  const docked = getPwaPromptPositionClasses(true);
  const undocked = getPwaPromptPositionClasses(false);
  assert.equal(docked.left, undocked.left);
  assert.equal(docked.right, undocked.right);
});

test('docked mode sits above the bottom nav; undocked mode sits at the safe-area edge', () => {
  assert.equal(
    getPwaPromptPositionClasses(true).bottom,
    'bottom-[calc(5.25rem+env(safe-area-inset-bottom))]'
  );
  assert.equal(
    getPwaPromptPositionClasses(false).bottom,
    'bottom-[max(1rem,env(safe-area-inset-bottom))]'
  );
});

test('both left and right insets still respect the safe-area, not just a flat margin', () => {
  for (const mode of [true, false]) {
    const { left, right } = getPwaPromptPositionClasses(mode);
    assert.match(left, /env\(safe-area-inset-left\)/);
    assert.match(right, /env\(safe-area-inset-right\)/);
  }
});

test('the right inset clears the reaction rail with margin, in both dock modes', () => {
  // FullScreenVideoFeed.tsx: `absolute bottom-24 right-2 z-[60] sm:bottom-32
  // sm:right-3` — the rail sits `right-2` (0.5rem) off the edge at the mobile
  // width where this sm:hidden prompt can render (it only widens to
  // `sm:right-3` above that breakpoint, where the prompt is already hidden).
  // FloatingReactions.tsx's widest buttons (avatar, roast, toast) are
  // `h-11 w-11` (2.75rem). So the rail's occupied strip reaches
  // 0.5rem + 2.75rem = 3.25rem in from the viewport edge.
  const RAIL_OCCUPIED_REM = 0.5 + 2.75;
  for (const mode of [true, false]) {
    const { right } = getPwaPromptPositionClasses(mode);
    const match = right.match(/^right-\[calc\(([\d.]+)rem\+env\(safe-area-inset-right\)\)\]$/);
    assert.ok(match, `unexpected right inset format: ${right}`);
    const clearanceRem = Number(match![1]);
    assert.ok(
      clearanceRem > RAIL_OCCUPIED_REM,
      `right inset (${clearanceRem}rem) does not clear the rail's occupied strip (${RAIL_OCCUPIED_REM}rem)`
    );
  }
});

test('the rail geometry this math is derived from has not silently drifted', () => {
  // Guards the constants asserted in the previous test's comment against the
  // actual source, so a future rail resize is caught here instead of
  // reintroducing the collision silently.
  assert.match(
    read('FullScreenVideoFeed.tsx'),
    /absolute bottom-24 right-2 z-\[60\] sm:bottom-32 sm:right-3/,
    'the rail container offset changed — recompute RAIL_CLEARANCE_REM in PwaInstallPrompt.tsx'
  );
  assert.match(
    read('FloatingReactions.tsx'),
    /h-11 w-11/,
    'FloatingReactions no longer has an h-11 w-11 button — recompute RAIL_CLEARANCE_REM in PwaInstallPrompt.tsx'
  );
});

test('the component renders the computed position classes, not hardcoded ones', () => {
  const source = read('PwaInstallPrompt.tsx');
  assert.match(source, /getPwaPromptPositionClasses\(dockToBottomNav\)/);
  assert.match(
    source,
    /\$\{positionClasses\.left\} \$\{positionClasses\.right\} \$\{positionClasses\.bottom\}/,
    'the fixed wrapper must read all three insets from positionClasses'
  );
});

test('SignInModal keeps priority over the install prompt', () => {
  // SignInModal.tsx is z-[100]; this card must stay below it so the prompt
  // can never obscure an active sign-in flow.
  assert.match(read('PwaInstallPrompt.tsx'), /z-\[90\]/);
  const signInZ = read('SignInModal.tsx').match(/z-\[(\d+)\]/);
  assert.ok(signInZ, 'SignInModal has no z-[n] class to compare against');
  assert.ok(Number(signInZ![1]) > 90, 'SignInModal must render above the install prompt');
});

test('the dismiss and install/close buttons keep 44px touch targets', () => {
  const source = read('PwaInstallPrompt.tsx');
  const h11w11 = (source.match(/h-11 w-11/g) || []).length;
  assert.ok(h11w11 >= 2, 'expected at least the icon tile and dismiss button to be 44x44');
  const minH11 = (source.match(/min-h-11/g) || []).length;
  assert.equal(minH11, 3, 'expected the install/share-hint, install, and Later controls to all be min-h-11');
});
