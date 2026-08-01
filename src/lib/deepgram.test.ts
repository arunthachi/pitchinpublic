import assert from 'node:assert/strict';
import test from 'node:test';
import { extractDeepgramTranscript } from './deepgram';

test('extracts and trims the primary Deepgram transcript', () => {
  assert.equal(
    extractDeepgramTranscript({
      results: {
        channels: [{ alternatives: [{ transcript: '  Make the customer specific.  ' }] }],
      },
    }),
    'Make the customer specific.'
  );
});

test('returns an empty transcript when Deepgram detects no speech', () => {
  assert.equal(extractDeepgramTranscript({ results: { channels: [] } }), '');
  assert.equal(
    extractDeepgramTranscript({
      results: { channels: [{ alternatives: [{ transcript: null }] }] },
    }),
    ''
  );
});
