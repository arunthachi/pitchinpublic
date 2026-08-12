import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { requiresSignedPlayback } from './stream-tokens';
import { applySignedUrls } from './sign-rows';

const read = (rel: string) => readFileSync(path.join(process.cwd(), 'src', rel), 'utf8');
const SIGNED = new Map([['v1', { playbackUrl: 'https://cf/TOKEN/manifest/video.m3u8', thumbnailUrl: 'https://cf/TOKEN/thumbnails/thumbnail.jpg' }]]);

test('only private pitches require signing', () => {
  assert.equal(requiresSignedPlayback({ visibility: 'private' }), true);
  assert.equal(requiresSignedPlayback({ visibility: 'public' }), false);
  // Unknown or absent is treated as public: signing a shareable link by
  // accident would hand a founder a URL that dies in two hours.
  assert.equal(requiresSignedPlayback({ visibility: null }), false);
  assert.equal(requiresSignedPlayback({}), false);
  assert.equal(requiresSignedPlayback({ visibility: 'unlisted' }), false);
});

test('a public pitch keeps its canonical URL untouched', () => {
  // This is the sharing guarantee: post a best take to LinkedIn and it still
  // renders next month.
  const row = { video_id: 'v1', visibility: 'public', video_url: 'https://cf/v1/manifest/video.m3u8', thumbnail_url: 'https://cf/v1/thumb.jpg' };
  assert.deepEqual(applySignedUrls(row, SIGNED), row);
});

test('a private pitch gets the signed URLs', () => {
  const row = { video_id: 'v1', visibility: 'private', video_url: 'https://cf/v1/manifest/video.m3u8', thumbnail_url: 'https://cf/v1/thumb.jpg' };
  const out = applySignedUrls(row, SIGNED);
  assert.equal(out.video_url, 'https://cf/TOKEN/manifest/video.m3u8');
  assert.equal(out.thumbnail_url, 'https://cf/TOKEN/thumbnails/thumbnail.jpg');
});

test('a private pitch with no minted token keeps its stored URL', () => {
  // Phase 2a changes no access, so a mint failure must not blank the player.
  const row = { video_id: 'missing', visibility: 'private', video_url: 'https://cf/x/manifest/video.m3u8' };
  assert.deepEqual(applySignedUrls(row, SIGNED), row);
});

test('every surface that exposes a video URL signs it', () => {
  // Any surface left out ships an unsigned private URL, and breaks outright
  // once the videos require signatures.
  for (const surface of [
    'app/api/pitches/route.ts',
    'app/api/events/[slug]/route.ts',
    'app/api/reviews/queue/route.ts',
    'app/api/practice/today/route.ts',
  ]) {
    const source = read(surface);
    assert.match(source, /signPrivateRows\(/, `${surface} never signs`);
    assert.match(source, /applySignedUrls\(/, `${surface} never applies signed URLs`);
  }
});

test('every signing surface selects the fields the decision needs', () => {
  // Without video_id there is nothing to mint; without visibility everything
  // would be treated as public and never signed. Both have shipped broken once.
  for (const surface of [
    'app/api/pitches/route.ts',
    'app/api/events/[slug]/route.ts',
    'app/api/reviews/queue/route.ts',
    'app/api/practice/today/route.ts',
  ]) {
    const source = read(surface);
    assert.match(source, /\bvideo_id\b/, `${surface} does not select video_id`);
    assert.match(source, /\bvisibility\b/, `${surface} does not select visibility`);
  }
});
