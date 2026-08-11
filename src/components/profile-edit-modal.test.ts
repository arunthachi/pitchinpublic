import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { nextFocusIndex } from './ProfileEditModal';

/**
 * ProfileEditModal had no dialog semantics: no role, no focus trap, no
 * Escape-to-close, no focus restore, and the deck deep link landed on top of
 * a long form. These are source-level wiring assertions (see
 * app-shell-continuity.test.ts for the pattern this repo settled on) because
 * the behaviour lives in DOM APIs (focus, scrollIntoView, matchMedia) that a
 * jsdom-free `tsx --test` run can't exercise directly. Every assertion below
 * was mutation-verified: the defect was reintroduced, the test failed, then
 * the fix was restored.
 */

const ROOT = path.join(process.cwd(), 'src');

function read(relativePath: string) {
  return readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('the dialog exposes ARIA dialog semantics wired to the visible heading', () => {
  const modal = read('components/ProfileEditModal.tsx');
  assert.match(modal, /role="dialog"/);
  assert.match(modal, /aria-modal="true"/);
  assert.match(modal, /aria-labelledby="profile-edit-modal-title"/);
  // Both the form heading and the success heading must carry the id the
  // dialog labels itself with — they render in mutually exclusive branches,
  // so exactly one is ever in the DOM at a time.
  const labelledHeadings = (modal.match(/id="profile-edit-modal-title"/g) || []).length;
  assert.equal(labelledHeadings, 2, 'expected both the form and success headings to own the label id');
});

test('Escape closes the dialog, but not while a save is in flight', () => {
  const modal = read('components/ProfileEditModal.tsx');
  assert.match(
    modal,
    /if \(event\.key === 'Escape'\) \{\s*if \(loading\) return;[\s\S]{0,160}?onComplete\(\);/,
    'Escape must defer to an in-flight save the same way the disabled Cancel button does',
  );
});

test('Tab cycles forward and wraps at the end', () => {
  assert.equal(nextFocusIndex(4, 0, false), null, 'mid-list Tab is the browser default');
  assert.equal(nextFocusIndex(4, 2, false), null);
  assert.equal(nextFocusIndex(4, 3, false), 0, 'last wraps to first');
});

test('Shift+Tab cycles backward and wraps at the start', () => {
  assert.equal(nextFocusIndex(4, 3, true), null);
  assert.equal(nextFocusIndex(4, 0, true), 3, 'first wraps to last');
});

test('focus outside the list is pulled back in — the hole the first trap left', () => {
  // A normal open focuses the dialog CONTAINER, which carries tabIndex=-1 and
  // is not in the focusable list. The original trap compared only against the
  // first and last elements, so this case matched neither and Shift+Tab walked
  // focus out of the dialog and behind the overlay.
  assert.equal(nextFocusIndex(4, null, true), 3, 'Shift+Tab from the container goes to the last control');
  assert.equal(nextFocusIndex(4, null, false), 0, 'Tab from the container goes to the first control');
});

test('an empty dialog never traps the user', () => {
  assert.equal(nextFocusIndex(0, null, false), null);
  assert.equal(nextFocusIndex(0, null, true), null);
});

test('a single focusable control cycles to itself rather than escaping', () => {
  assert.equal(nextFocusIndex(1, 0, false), 0);
  assert.equal(nextFocusIndex(1, 0, true), 0);
});

test('the deck scroll claims its one-shot only after it actually runs', () => {
  const source = read('components/ProfileEditModal.tsx');
  // The one-shot used to be claimed before the animation frame. On mount
  // startupLoading is still false, so the first pass burned it, the fetch's
  // re-render cancelled that frame, and the post-fetch pass short-circuited —
  // the deep link never reached the deck. The claim must sit INSIDE the frame.
  const effect = source.slice(source.indexOf('Land deep-linked opens'));
  const frameAt = effect.indexOf('requestAnimationFrame');
  const claimAt = effect.indexOf('scrolledToDeckRef.current = true');
  assert.ok(frameAt !== -1 && claimAt !== -1, 'scroll effect not found');
  assert.ok(claimAt > frameAt, 'the one-shot is claimed before the frame runs');
  // ...and it must bail when the deck section is not mounted yet.
  assert.match(effect, /const target = deckSection;\s*\n\s*if \(!target\) return;/);
});

test('focus is not restored to a detached invoker', () => {
  const source = read('components/ProfileEditModal.tsx');
  // The deep link opens this from another page, so the invoker is usually gone.
  // Focusing a detached node silently drops focus to <body>.
  assert.match(source, /trigger\?\.isConnected/);
});

test('the deck section is tracked by a callback ref, not a plain ref', () => {
  const source = read('components/ProfileEditModal.tsx');
  // A plain useRef never re-runs the effect when its node mounts, and the deck
  // section mounts behind the startup fetch. Verified broken on staging: the
  // effect's only run saw a null ref, so the modal never scrolled — scrollTop
  // stayed 0 with the deck a full screen below the fold.
  assert.match(source, /const \[deckSection, setDeckSection\] = useState<HTMLDivElement \| null>\(null\);/);
  assert.match(source, /ref=\{setDeckSection\}/);
  assert.doesNotMatch(source, /deckSectionRef/, 'the plain ref must be gone entirely');

  // The node has to be a dependency, or mounting it still would not re-trigger.
  const effect = source.slice(source.indexOf('Land deep-linked opens'));
  assert.match(effect, /\}, \[isOpen, scrollToDeck, startupLoading, deckSection\]\);/);
});
