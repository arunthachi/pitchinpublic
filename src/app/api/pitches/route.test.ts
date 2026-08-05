import assert from 'node:assert/strict';
import test from 'node:test';
import * as pitchRoute from './route';

const { hashPitchCreationPayload, parsePitchIdempotencyKey } = pitchRoute;

const KEY = '70d46f48-2f9b-4a3c-9500-8309a86e7639';

test('pitch idempotency keys are optional but must be UUIDs when present', () => {
  assert.deepEqual(parsePitchIdempotencyKey(null), { key: null, valid: true });
  assert.deepEqual(parsePitchIdempotencyKey(KEY), { key: KEY, valid: true });
  assert.deepEqual(parsePitchIdempotencyKey('retry-1'), { key: null, valid: false });
});

test('equivalent normalized pitch payloads have the same hash and changed payloads conflict', () => {
  const payload = {
    hook: 'A clear pitch hook',
    videoId: 'video-1',
    playbackUrl: 'https://example.com/video.m3u8',
    duration: 60,
  };

  assert.equal(hashPitchCreationPayload(payload), hashPitchCreationPayload({ ...payload }));
  assert.notEqual(
    hashPitchCreationPayload(payload),
    hashPitchCreationPayload({ ...payload, hook: 'A materially different pitch hook' })
  );
});

test('pitch creation route does not expose DELETE', () => {
  assert.equal(Reflect.has(pitchRoute, 'DELETE'), false);
});
