import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const read = (rel: string) => readFileSync(path.join(process.cwd(), 'src', rel), 'utf8');

test('uploads do not enforce signing by default', () => {
  const provider = read('lib/video-providers/cloudflare-stream.ts');
  // Most pitches are public and a public pitch must keep a permanent shareable
  // URL. Defaulting this on would break social sharing for everyone.
  assert.match(provider, /requireSignedURLs: metadata\?\.requireSignedURLs === true/);
});

test('enforcement follows visibility in BOTH directions', () => {
  const route = read('app/api/pitches/[pitchId]/visibility/route.ts');
  // Going private revokes the URLs already in circulation — the point of the
  // whole exercise. Going public lifts it so sharing works again.
  assert.match(route, /setRequireSignedUrls\(updated\.video_id, updated\.visibility === 'private'\)/);
  // The video id has to come back from the update or there is nothing to flip.
  assert.match(route, /\.select\('id, public_id, visibility, event_id, video_id'\)/);
});

test('a private pitch is locked at creation, not just on toggle', () => {
  const route = read('app/api/pitches/route.ts');
  // An event submission is private from birth; waiting for a toggle that may
  // never happen would leave it playable by anyone with the URL.
  assert.match(route, /if \(eventTarget && pitchData\.videoId\)/);
  assert.match(route, /setRequireSignedUrls\(pitchData\.videoId, true\)/);
});

test('enforcement failures never block the founder', () => {
  const toggle = read('app/api/pitches/[pitchId]/visibility/route.ts');
  const create = read('app/api/pitches/route.ts');
  // The database row is the source of truth for what the app serves. A
  // Cloudflare blip must not cost a founder their recording or trap them at a
  // visibility they did not choose.
  assert.match(toggle, /enforcementSynced/, 'the toggle must report sync state rather than throw');
  assert.match(create, /Private pitch created without playback enforcement/);
  assert.doesNotMatch(create, /throw new Error\('Could not lock/);
});

test('the toggle tells the caller whether old links are actually dead', () => {
  const route = read('app/api/pitches/[pitchId]/visibility/route.ts');
  // Reporting success while Cloudflare rejected the change would tell a founder
  // their pitch is private when the old URLs still play.
  const finalReturn = route.slice(route.lastIndexOf('return NextResponse.json({'));
  assert.match(finalReturn, /enforcementSynced,/);
});

test('the recorder poll signs a video that already belongs to a private pitch', () => {
  const route = read('app/api/videos/[videoId]/route.ts');
  // The provider returns canonical URLs, which is right for a fresh upload but
  // 403s once the video is enforced — the recorder would show a dead preview.
  assert.match(route, /\.eq\('visibility', 'private'\)/);
  assert.match(route, /signPrivateRows\(\[owningPitch\]\)/);
  assert.match(route, /playbackUrl: urls\.playbackUrl/);
});
