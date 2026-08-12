import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT = path.join(process.cwd(), 'src');
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8');

test('the pitch selects fetch video_id, or nothing can ever be signed', () => {
  // The signing change shipped inert once: both SELECT lists returned
  // video_url and thumbnail_url but not video_id, so signedUrlsForRows got no
  // ids and every response stayed unsigned. The unit tests passed because they
  // injected synthetic rows that DID contain video_id.
  const route = read('app/api/pitches/route.ts');
  const selects = route.match(/const \w*[Ss]elect = `[\s\S]*?`/g) || [];
  assert.ok(selects.length >= 2, `expected the full and fallback selects, found ${selects.length}`);
  for (const select of selects) {
    assert.match(select, /\bvideo_id\b/, 'a pitch select omits video_id, so signing is a no-op');
  }
});

test('the video status endpoint is authenticated and owner-scoped', () => {
  const route = read('app/api/videos/[videoId]/route.ts');
  // This was unauthenticated and returned any video's playback URL. Video ids
  // are embedded in thumbnail URLs, so anyone who loaded the feed had one.
  assert.match(route, /auth\.getUser\(\)/);
  assert.match(route, /from\('video_uploads'\)/);
  assert.match(route, /ownership\.user_id !== user\.id/);
  // Unknown and not-yours must be indistinguishable, or the 403 confirms the id.
  const notFound = (route.match(/status: 404/g) || []).length;
  assert.ok(notFound >= 2, 'not-yours must 404 like unknown, not 403');
});

test('the duplicate unauthenticated metadata endpoint is gone', () => {
  let exists = true;
  try {
    read('app/api/videos/metadata/route.ts');
  } catch {
    exists = false;
  }
  assert.equal(exists, false, '/api/videos/metadata returned arbitrary playback URLs with no auth');
});

test('a video may only be attached to a pitch by its uploader', () => {
  const route = read('app/api/pitches/route.ts');
  // Otherwise a caller stores someone else's video id on their own pitch and,
  // once Phase 2 requires signed playback, the server mints them a valid token
  // for a video they never uploaded.
  assert.match(route, /videoOwner\.user_id !== user\.id/);
  assert.match(route, /code: 'video_not_owned'/);
});

test('ownership is recorded when the upload URL is issued', () => {
  const route = read('app/api/videos/upload-url/route.ts');
  assert.match(route, /from\('video_uploads'\)/);
  assert.match(route, /user_id: user\.id/);
  // A failure here must not hand back an id that can never be read or attached.
  assert.match(route, /code: 'ownership_record_failed'/);
});

test('the ownership table is service-write only and backfilled', () => {
  const migration = readFileSync(
    path.join(process.cwd(), 'supabase/migrations/20260811210000_add_video_upload_ownership.sql'),
    'utf8',
  );
  // A client that could insert here would claim any video id and defeat the point.
  assert.match(migration, /REVOKE INSERT, UPDATE, DELETE ON public\.video_uploads FROM authenticated, anon;/);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /auth\.uid\(\) = user_id/);
  // Existing pitches must keep working: their author is the uploader.
  assert.match(migration, /INSERT INTO public\.video_uploads[\s\S]*FROM public\.pitches/);
  assert.match(migration, /ON CONFLICT \(video_id\) DO NOTHING/);
});

test('the ownership checks fail closed, not open', () => {
  // A security check that skips itself when its client is missing is not a
  // check. Both sites previously guarded with `if (client)`, so an absent
  // service role key silently allowed any caller to attach any video id.
  const pitches = read('app/api/pitches/route.ts');
  assert.match(pitches, /if \(!ownershipClient\) \{/);
  assert.match(pitches, /code: 'ownership_unavailable'/);
  assert.doesNotMatch(
    pitches,
    /const ownershipClient = createServiceSupabase\(\);\s*\n\s*if \(ownershipClient\) \{/,
    'the pitch ownership check must not be conditional on the client existing',
  );

  const upload = read('app/api/videos/upload-url/route.ts');
  assert.match(upload, /if \(!serviceSupabase\) \{/);
  assert.match(upload, /code: 'ownership_unavailable'/);
  assert.doesNotMatch(
    upload,
    /const serviceSupabase = createServiceSupabase\(\);\s*\n\s*if \(serviceSupabase\) \{/,
    'upload must not issue an id it cannot bind to a user',
  );
});

test('every upload issuer records ownership', () => {
  // There are two. Missing the second left ids with no owner row, and publish
  // accepted a missing row, so anyone obtaining such an id could attach it.
  for (const issuer of ['app/api/videos/upload-url/route.ts', 'app/api/pitches/upload-url/route.ts']) {
    const source = read(issuer);
    assert.match(source, /from\('video_uploads'\)/, `${issuer} issues ids without binding an owner`);
    assert.match(source, /user_id: user\.id/, `${issuer} does not bind to the caller`);
    assert.match(source, /code: 'ownership_unavailable'/, `${issuer} does not fail closed`);
  }
});

test('publish requires an ownership row, not merely a matching one', () => {
  const route = read('app/api/pitches/route.ts');
  // Rejecting only a MISMATCH lets an unbound id through. Both issuers record
  // and the migration backfilled existing pitches, so absent means not ours.
  assert.match(route, /if \(!videoOwner \|\| videoOwner\.user_id !== user\.id\)/);
});
