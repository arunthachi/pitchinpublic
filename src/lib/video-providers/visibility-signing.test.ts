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
  // Phase 2a changes no access, so a mint failure must not blank the player —
  // but the provider id is still withheld, or the fallback becomes the leak.
  const row = { video_id: 'missing', visibility: 'private', video_url: 'https://cf/x/manifest/video.m3u8' };
  const out = applySignedUrls(row, SIGNED);
  assert.equal(out.video_url, row.video_url, 'the player must not go blank');
  assert.equal(out.video_id, undefined, 'the id must not survive the fallback');
});



test('EVERY pitch select carries the fields the decision needs', () => {
  // Per-select, not per-file. A file-level "mentions visibility somewhere"
  // assertion passed while the fallback SELECT omitted it, so private rows read
  // as undefined and silently stayed unsigned.
  const route = read('app/api/pitches/route.ts');
  const selects = route.match(/const \w*[Ss]elect = `[\s\S]*?`/g) || [];
  assert.ok(selects.length >= 2, `expected both selects, found ${selects.length}`);
  for (const select of selects) {
    assert.match(select, /\bvideo_id\b/, 'a pitch select omits video_id');
    assert.match(select, /\bvisibility\b/, 'a pitch select omits visibility, so nothing is ever signed');
  }
});

test('every pitch RESPONSE path signs, not just the feed', () => {
  const route = read('app/api/pitches/route.ts');
  // An event pitch is private from birth, so the create and replay responses
  // hand its own author an unsigned URL unless they sign too.
  const responseCalls = route.match(/pitch: (await pitchResponseSigned|pitchResponse)\(/g) || [];
  assert.ok(responseCalls.length >= 2, `expected create + replay, found ${responseCalls.length}`);
  for (const call of responseCalls) {
    assert.match(call, /pitchResponseSigned/, 'a pitch response path returns unsigned URLs');
  }
});

test('the event payload signs every pitch it exposes, including the caller own', () => {
  const route = read('app/api/events/[slug]/route.ts');
  // userSubmission is the founder's own private take and was returned raw
  // beside the signed copies.
  assert.match(route, /submissionPitch\(userSubmission\)/, 'userSubmission is not fed into signing');
  assert.match(route, /userSubmission: signedUserSubmission/, 'the raw userSubmission is still returned');
  // Array embeds must keep every element, not just the first.
  assert.match(route, /row\.pitch\.map\(/, 'array-shaped embeds lose elements when reshaped');
});

test('a private pitch never ships the ingredients to rebuild its unsigned URL', () => {
  // A canonical Cloudflare URL is host + video id, and the host is visible in
  // every public pitch's URL. Serving a signed URL while shipping the id beside
  // it lets any current event member construct a permanent unsigned URL that
  // outlives their membership.
  const row = { video_id: 'v1', visibility: 'private', video_url: 'https://cf/v1/manifest/video.m3u8' };
  const out = applySignedUrls(row, SIGNED);
  assert.equal(out.video_id, undefined, 'the provider id leaked on a private pitch');
  assert.equal(out.video_url, 'https://cf/TOKEN/manifest/video.m3u8');
});

test('a private pitch withholds its id even when no token could be minted', () => {
  // The fallback path must not become the leak.
  const row = { video_id: 'nope', visibility: 'private', video_url: 'https://cf/nope/manifest/video.m3u8' };
  assert.equal(applySignedUrls(row, SIGNED).video_id, undefined);
});

test('a public pitch keeps its id, since its URL is meant to be shareable', () => {
  const row = { video_id: 'v1', visibility: 'public', video_url: 'https://cf/v1/manifest/video.m3u8' };
  assert.equal(applySignedUrls(row, SIGNED).video_id, 'v1');
});
