import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const read = (path: string) => readFile(new URL(path, import.meta.url), 'utf8');

test('the app sign-in deep link is narrow and does not replace authenticated home', async () => {
  const source = await read('../app/page.tsx');

  assert.match(source, /if \(loading \|\| user\) return;[\s\S]{0,180}searchParams\.get\('signin'\) === '1'/);
  assert.match(source, /stripQueryParam\('signin'\)/);
  assert.doesNotMatch(source, /searchParams\.has\('signin'\)/);
});

test('only the authenticated app shell renders the PWA install prompt', async () => {
  const source = await read('../app/page.tsx');
  const prompts = source.match(/<PwaInstallPrompt\b/g) || [];

  assert.equal(prompts.length, 1);
  assert.match(source, /<PwaInstallPrompt dockToBottomNav=\{!isGuest && !reviewerMode\}/);
});

test('the anonymous app access surface contains no synthetic founder metrics or legacy feed pitch', async () => {
  const source = await read('./WelcomeHero.tsx');

  assert.doesNotMatch(source, /60-second|TikTok|clarityDelta|founderName|scores:/i);
  assert.match(source, /Pitch Standard/);
  assert.match(source, /structured human feedback/);
  assert.match(source, /Best Take/);
});

test('lead capture implements the keyboard and failure-preservation contract', async () => {
  const source = await read('./LeadCaptureModal.tsx');

  assert.match(source, /event\.key === 'Escape'/);
  assert.match(source, /event\.key !== 'Tab'/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /aria-describedby=\{descriptionId\}/);
  assert.match(source, /titleRef\.current\?\.focus\(\)/);
  assert.match(source, /aria-invalid=\{fieldErrors\.email \? true : undefined\}/);
  assert.match(source, /aria-describedby=\{fieldErrors\.email \? emailErrorId : undefined\}/);
  assert.match(source, /emailRef\.current\?\.focus\(\)/);
  assert.match(source, /href="mailto:hello@pitchinpublic\.io"/);
  assert.doesNotMatch(source, /catch \(error\)[\s\S]{0,260}setEmail\(''\)/);
});
