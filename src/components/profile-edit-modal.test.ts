import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

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

test('Tab is trapped inside the dialog in both directions', () => {
  const modal = read('components/ProfileEditModal.tsx');
  assert.match(modal, /event\.key !== 'Tab'/);
  assert.match(
    modal,
    /event\.shiftKey && document\.activeElement === first\)\s*\{\s*event\.preventDefault\(\);\s*last\.focus\(\);/,
    'Shift+Tab on the first element must wrap to the last',
  );
  assert.match(
    modal,
    /!event\.shiftKey && document\.activeElement === last\)\s*\{\s*event\.preventDefault\(\);\s*first\.focus\(\);/,
    'Tab on the last element must wrap to the first',
  );
});

test('focus enters the dialog on open and returns to the invoker on close', () => {
  const modal = read('components/ProfileEditModal.tsx');
  assert.match(
    modal,
    /previouslyFocusedRef\.current = document\.activeElement as HTMLElement \| null;/,
    'the invoker must be captured before focus moves into the dialog',
  );
  assert.match(modal, /dialogRef\.current\?\.focus\(\)/, 'a normal open must focus the dialog container');
  assert.match(
    modal,
    /const trigger = previouslyFocusedRef\.current;\s*if \(trigger\) window\.requestAnimationFrame\(\(\) => trigger\.focus\(\)\);/,
    'closing must hand focus back to whatever opened the dialog',
  );
});

test('the deep link threads scrollToDeck from the query handler to the modal, and clears it on close', () => {
  const home = read('app/page.tsx');
  // The deep-link effect (guarded by handledProfileEditQueryRef, see
  // app-shell-continuity.test.ts) must arm the deck target before opening.
  assert.match(
    home,
    /handledProfileEditQueryRef\.current = true;\s*setProfileEditScrollToDeck\(true\);\s*setShowProfileEdit\(true\);/,
  );
  assert.match(home, /scrollToDeck=\{profileEditScrollToDeck\}/);
  // onComplete is the single close path (backdrop click, Cancel, and the
  // post-save timeout all call it), so clearing there covers every close.
  assert.match(home, /setShowProfileEdit\(false\);\s*setProfileEditScrollToDeck\(false\);/);
});

test('the deck scroll waits for the startup fetch to settle before landing on it', () => {
  const modal = read('components/ProfileEditModal.tsx');
  // DeckManager is only mounted once startupLoading flips false; scrolling
  // earlier would find deckSectionRef.current still null.
  assert.match(
    modal,
    /if \(!scrollToDeck \|\| startupLoading \|\| scrolledToDeckRef\.current\) return;/,
  );
  assert.match(modal, /window\.matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches/);
  assert.match(
    modal,
    /target\.scrollIntoView\(\{ behavior: reduceMotion \? 'auto' : 'smooth', block: 'start' \}\);/,
  );
});
